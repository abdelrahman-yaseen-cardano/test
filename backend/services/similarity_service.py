"""
Similarity service: computes combined SSIM + colour-histogram score between
video first/last frames.

Score = 0.6 × SSIM(gray) + 0.4 × HSV histogram correlation

Architecture:
 - In-memory cache of gray frame arrays (for SSIM) keyed by node_id + side
 - In-memory cache of BGR frame arrays (for colour histogram) keyed similarly
 - Persistent similarity matrix stored as JSON on disk
 - When new nodes are added, incrementally updates the matrix

Matrix stored as:  scores[last_owner_id][first_owner_id] = combined_score
Interpretation: Can we travel FROM last_owner TO first_owner?
"""
from __future__ import annotations
import json
import threading
from pathlib import Path

import cv2
import numpy as np
from skimage.metrics import structural_similarity as compare_ssim

from services.frame_extractor import load_frame_array, load_color_frame_array

CACHE_FILE = Path("uploads/similarity_cache.json")
FRAME_SIZE = (256, 256)
DEFAULT_THRESHOLD = 0.75

_lock = threading.RLock()

# In-memory frame caches
_frame_cache: dict[str, np.ndarray] = {}        # grayscale float32 for SSIM
_color_cache: dict[str, np.ndarray] = {}        # BGR uint8 for histogram

# Similarity matrix: { last_owner_id: { first_owner_id: score } }
_matrix: dict[str, dict[str, float]] = {}


def _load_matrix() -> None:
    global _matrix
    if CACHE_FILE.exists():
        try:
            _matrix = json.loads(CACHE_FILE.read_text())
        except Exception:
            _matrix = {}


def _save_matrix() -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(_matrix))


_load_matrix()


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def register_node(node_id: str, first_frame_path: str, last_frame_path: str) -> None:
    """
    Register frames for a new node and compute combined score against all existing nodes.
    Called once after upload & frame extraction.
    """
    with _lock:
        # Load grayscale (SSIM) and colour (histogram) arrays
        _frame_cache[f"{node_id}_first"] = load_frame_array(first_frame_path, FRAME_SIZE)
        _frame_cache[f"{node_id}_last"] = load_frame_array(last_frame_path, FRAME_SIZE)
        _color_cache[f"{node_id}_first"] = load_color_frame_array(first_frame_path, FRAME_SIZE)
        _color_cache[f"{node_id}_last"] = load_color_frame_array(last_frame_path, FRAME_SIZE)

        existing_ids = list(_matrix.keys()) + [node_id]
        existing_ids = list(dict.fromkeys(existing_ids))  # deduplicate, preserve order

        # Ensure matrix rows/cols exist
        for nid in existing_ids:
            _matrix.setdefault(nid, {})

        # Compute pairwise score for ALL (a_last, b_first) pairs that involve new node
        for a_id in existing_ids:
            for b_id in existing_ids:
                if b_id in _matrix.get(a_id, {}):
                    continue  # already computed
                if a_id not in (node_id,) and b_id not in (node_id,):
                    continue  # neither is new, skip
                a_last_gray = _frame_cache.get(f"{a_id}_last")
                b_first_gray = _frame_cache.get(f"{b_id}_first")
                a_last_color = _color_cache.get(f"{a_id}_last")
                b_first_color = _color_cache.get(f"{b_id}_first")
                if a_last_gray is None or b_first_gray is None:
                    continue
                score = _combined_score(a_last_gray, b_first_gray, a_last_color, b_first_color)
                _matrix[a_id][b_id] = round(score, 4)

        _save_matrix()


def remove_node(node_id: str) -> None:
    """Remove a node from the similarity matrix and frame caches."""
    with _lock:
        _matrix.pop(node_id, None)
        for v in _matrix.values():
            v.pop(node_id, None)
        _frame_cache.pop(f"{node_id}_first", None)
        _frame_cache.pop(f"{node_id}_last", None)
        _color_cache.pop(f"{node_id}_first", None)
        _color_cache.pop(f"{node_id}_last", None)
        _save_matrix()


def get_compatible_targets(
    source_id: str, threshold: float = DEFAULT_THRESHOLD
) -> list[dict]:
    """
    Returns list of {node_id, side: 'left', score} for all nodes whose first frame
    matches source_id's last frame above the threshold.
    i.e. source emits from its RIGHT knob → who can it connect to on their LEFT knob?
    """
    with _lock:
        row = _matrix.get(source_id, {})
        return [
            {"node_id": nid, "side": "left", "score": score}
            for nid, score in row.items()
            if score >= threshold
        ]


def get_compatible_sources(
    target_id: str, threshold: float = DEFAULT_THRESHOLD
) -> list[dict]:
    """
    Returns list of {node_id, side: 'right', score} for all nodes whose last frame
    matches target_id's first frame above the threshold.
    i.e. target accepts on its LEFT knob → who can connect from their RIGHT knob?
    """
    with _lock:
        return [
            {"node_id": src_id, "side": "right", "score": row.get(target_id, 0)}
            for src_id, row in _matrix.items()
            if row.get(target_id, 0) >= threshold
        ]


def get_full_matrix() -> dict[str, dict[str, float]]:
    with _lock:
        return {k: dict(v) for k, v in _matrix.items()}


def reload_frame_cache(node_id: str, first_frame_path: str, last_frame_path: str) -> None:
    """Re-warm frame cache if server restarted."""
    with _lock:
        if f"{node_id}_first" not in _frame_cache:
            try:
                _frame_cache[f"{node_id}_first"] = load_frame_array(first_frame_path, FRAME_SIZE)
            except Exception:
                pass
        if f"{node_id}_last" not in _frame_cache:
            try:
                _frame_cache[f"{node_id}_last"] = load_frame_array(last_frame_path, FRAME_SIZE)
            except Exception:
                pass
        if f"{node_id}_first" not in _color_cache:
            try:
                _color_cache[f"{node_id}_first"] = load_color_frame_array(first_frame_path, FRAME_SIZE)
            except Exception:
                pass
        if f"{node_id}_last" not in _color_cache:
            try:
                _color_cache[f"{node_id}_last"] = load_color_frame_array(last_frame_path, FRAME_SIZE)
            except Exception:
                pass


# ──────────────────────────────────────────────
# Internals
# ──────────────────────────────────────────────

def _ssim(a: np.ndarray, b: np.ndarray) -> float:
    """Compute SSIM between two grayscale float arrays in [0,1]."""
    score, _ = compare_ssim(a, b, full=True, data_range=1.0)
    return float(score)


def _hist_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Compute colour similarity via HSV histogram correlation.
    a, b are BGR uint8 arrays of equal size.
    Returns value in [-1, 1]; 1.0 = identical colour distribution.
    """
    if a is None or b is None or a.size == 0 or b.size == 0:
        return 0.0
    a_hsv = cv2.cvtColor(a, cv2.COLOR_BGR2HSV)
    b_hsv = cv2.cvtColor(b, cv2.COLOR_BGR2HSV)
    # Compare H, S, V separately then average
    total = 0.0
    for ch in range(3):
        bins = 32 if ch < 2 else 16  # finer bins for hue/saturation
        hist_a = cv2.calcHist([a_hsv], [ch], None, [bins], [0, 256])
        hist_b = cv2.calcHist([b_hsv], [ch], None, [bins], [0, 256])
        cv2.normalize(hist_a, hist_a)
        cv2.normalize(hist_b, hist_b)
        total += float(cv2.compareHist(hist_a, hist_b, cv2.HISTCMP_CORREL))
    return total / 3.0


def _combined_score(
    a_gray: np.ndarray,
    b_gray: np.ndarray,
    a_color: np.ndarray | None,
    b_color: np.ndarray | None,
) -> float:
    """
    Combined similarity: 60% structural SSIM + 40% HSV histogram correlation.
    Both components normalised to [0, 1].
    """
    ssim_score = max(0.0, _ssim(a_gray, b_gray))                       # [0,1]
    hist_score = (max(0.0, _hist_similarity(a_color, b_color))          # [-1,1] → [0,1]
                  if a_color is not None and b_color is not None else 0.0)
    return 0.6 * ssim_score + 0.4 * hist_score
