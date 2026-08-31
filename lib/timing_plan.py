"""MiniMax H3 T8 audio-sync timing (ported from comfyui-minimax-h3-audio-T8/timing.py)."""

from __future__ import annotations

import math

FPS = 24.0
MIN_TRAINED_FRAMES = 124


def align_frame_count(frame_count: int) -> int:
    frame_count = max(5, int(frame_count))
    return frame_count + ((5 - frame_count) % 17)


def make_timing_plan(
    scene_start_seconds: float,
    scene_duration_seconds: float,
    warmup_seconds: float = 0.0,
    cooldown_seconds: float = 0.0,
    ensure_minimum_context: bool = True,
    source_duration_seconds: float = 0.0,
) -> dict[str, float]:
    if scene_start_seconds < 0:
        raise ValueError("scene_start_seconds cannot be negative")
    if scene_duration_seconds <= 0:
        raise ValueError("scene_duration_seconds must be positive")
    if warmup_seconds < 0 or cooldown_seconds < 0:
        raise ValueError("warmup_seconds and cooldown_seconds cannot be negative")

    required = warmup_seconds + scene_duration_seconds + cooldown_seconds
    if ensure_minimum_context:
        required = max(required, MIN_TRAINED_FRAMES / FPS)
    extra = max(0.0, required - (warmup_seconds + scene_duration_seconds + cooldown_seconds))
    ideal_start = scene_start_seconds - warmup_seconds - extra / 2.0
    ideal_end = scene_start_seconds + scene_duration_seconds + cooldown_seconds + extra / 2.0

    frame_count = align_frame_count(math.ceil((ideal_end - ideal_start) * FPS - 1e-9))
    render_duration = frame_count / FPS
    ideal_end = ideal_start + render_duration
    slice_start = max(0.0, ideal_start)
    left_pad = max(0.0, -ideal_start)
    available_end = source_duration_seconds if source_duration_seconds > 0 else ideal_end
    slice_end = min(ideal_end, available_end)
    slice_duration = max(0.0, slice_end - slice_start)
    trim_start = scene_start_seconds - ideal_start

    return {
        "source_slice_start_seconds": float(slice_start),
        "source_slice_duration_seconds": float(slice_duration),
        "final_trim_start_seconds": float(trim_start),
        "final_duration_seconds": float(scene_duration_seconds),
    }
