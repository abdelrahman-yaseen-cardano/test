"""
Similarity service: computes SSIM between video first/last frames.

Architecture:
 - In-memory cache of frame arrays (keyed by node_id + side)
 - Persistent similarity matrix stored as JSON on disk
 - When new nodes are added, incrementally updates the matrix

Matrix stored as:  scores[last_owner_id][first_owner_id] = ssim_score
Interpretation: Can we travel FROM last_owner TO first_owner?
"""
from __future__ import annotations
import json
import threading
from pathlib import Path

import numpy as np
from skimage.metrics import structural_similarity as compare_ssim

from services.frame_extractor import load_frame_array

CACHE_FILE = Path("uploads/similarity_cache.json")
FRAME_SIZE = (256, 256)
DEFAULT_THRESHOLD = 0.75

_lock = threading.RLock()

# In-memory frame array cache: {f"{node_id}_{side}": np.ndarray}
_frame_cache: dict[str, np.ndarray] = {}

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
    Register frames for a new node and compute SSIM against all existing nodes.
    Called once after upload & frame extraction.
    """
    with _lock:
        # Load frames into cache
        _frame_cache[f"{node_id}_first"] = load_frame_array(first_frame_path, FRAME_SIZE)
        _frame_cache[f"{node_id}_last"] = load_frame_array(last_frame_path, FRAME_SIZE)

        existing_ids = list(_matrix.keys()) + [node_id]
        existing_ids = list(dict.fromkeys(existing_ids))  # deduplicate, preserve order

        # Ensure matrix rows/cols exist
        for nid in existing_ids:
            _matrix.setdefault(nid, {})

        # Compute pairwise SSIM for ALL (a_last, b_first) pairs that involve new node
        for a_id in existing_ids:
            for b_id in existing_ids:
                if b_id in _matrix.get(a_id, {}):
                    continue  # already computed
                if a_id not in (node_id,) and b_id not in (node_id,):
                    continue  # neither is new, skip
                a_last = _frame_cache.get(f"{a_id}_last")
                b_first = _frame_cache.get(f"{b_id}_first")
                if a_last is None or b_first is None:
                    continue
                score = _ssim(a_last, b_first)
                _matrix[a_id][b_id] = round(score, 4)

        _save_matrix()


def remove_node(node_id: str) -> None:
    """Remove a node from the similarity matrix and frame cache."""
    with _lock:
        _matrix.pop(node_id, None)
        for v in _matrix.values():
            v.pop(node_id, None)
        _frame_cache.pop(f"{node_id}_first", None)
        _frame_cache.pop(f"{node_id}_last", None)
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


# ──────────────────────────────────────────────
# Internals
# ──────────────────────────────────────────────

def _ssim(a: np.ndarray, b: np.ndarray) -> float:
    """Compute SSIM between two grayscale float arrays in [0,1]."""
    score, _ = compare_ssim(a, b, full=True, data_range=1.0)
    return float(score)
