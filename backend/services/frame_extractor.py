"""
Frame extraction service using ffmpeg.
Extracts first and last frames of videos, stores them as JPEGs.
"""
from __future__ import annotations
import asyncio
import hashlib
import json
import os
import subprocess
from pathlib import Path

import cv2
import numpy as np

FRAMES_DIR = Path("uploads/frames")
FRAMES_DIR.mkdir(parents=True, exist_ok=True)


def _frame_path(video_id: str, label: str) -> Path:
    return FRAMES_DIR / f"{video_id}_{label}.jpg"


def extract_frames(video_path: str, video_id: str) -> dict:
    """
    Extract first and last frames + metadata from a video file.
    Returns dict with keys: first_frame_path, last_frame_path, duration, width, height.
    """
    first_out = _frame_path(video_id, "first")
    last_out = _frame_path(video_id, "last")

    # ---------- Probe metadata ----------
    probe_cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", str(video_path),
    ]
    result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    info = json.loads(result.stdout)
    video_stream = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "video"), None
    )
    if not video_stream:
        raise ValueError("No video stream found in file")

    duration = float(info.get("format", {}).get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # ---------- First frame ----------
    if not first_out.exists():
        cmd = [
            "ffmpeg", "-y", "-ss", "0", "-i", str(video_path),
            "-vframes", "1", "-q:v", "2", str(first_out),
        ]
        subprocess.run(cmd, capture_output=True, timeout=30, check=True)

    # ---------- Last frame ----------
    if not last_out.exists():
        # Seek to near end then take last available frame
        seek_time = max(0, duration - 0.5)
        cmd = [
            "ffmpeg", "-y", "-ss", str(seek_time), "-i", str(video_path),
            "-vframes", "1", "-q:v", "2", str(last_out),
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=30)
        # Fallback: use OpenCV to grab last frame
        if r.returncode != 0 or not last_out.exists():
            _extract_last_frame_cv2(str(video_path), str(last_out))

    return {
        "first_frame_path": str(first_out),
        "last_frame_path": str(last_out),
        "duration": duration,
        "width": width,
        "height": height,
    }


def _extract_last_frame_cv2(video_path: str, out_path: str) -> None:
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total - 1))
    ret, frame = cap.read()
    cap.release()
    if ret:
        cv2.imwrite(out_path, frame)
    else:
        raise RuntimeError(f"Could not read last frame from {video_path}")


def load_frame_array(frame_path: str, size: tuple[int, int] = (256, 256)) -> np.ndarray:
    """Load a frame image, resize, return grayscale numpy array (H, W) in [0,1]."""
    img = cv2.imread(frame_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(f"Frame not found: {frame_path}")
    return cv2.resize(img, size, interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0


def load_color_frame_array(frame_path: str, size: tuple[int, int] = (256, 256)) -> np.ndarray:
    """Load a frame image, resize, return BGR uint8 numpy array (H, W, 3)."""
    img = cv2.imread(frame_path, cv2.IMREAD_COLOR)
    if img is None:
        return np.zeros((*size, 3), dtype=np.uint8)
    return cv2.resize(img, size, interpolation=cv2.INTER_AREA)
