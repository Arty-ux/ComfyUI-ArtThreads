import pytest

from lib.duration_math import (
    DEFAULTS,
    compute,
    frames_from_seconds,
    parse_state,
    snap_frames,
)


def test_snap_frames_h3_grid():
    assert snap_frames(120, 17, 5) == 124
    assert snap_frames(124, 17, 5) == 124
    assert snap_frames(125, 17, 5) == 141


def test_snap_frames_disabled_when_step_one():
    assert snap_frames(120, 1, 5) == 120


def test_frames_from_seconds_minimax_h3_default():
    assert frames_from_seconds(5, 24, 17, 5, 5) == 124


def test_compute_returns_actual_seconds_after_snap():
    frames, actual = compute({"seconds": 5, "fps": 24, "step": 17, "plus": 5})
    assert frames == 124
    assert actual == pytest.approx(124 / 24)


def test_parse_state_merges_partial_json():
    state = parse_state('{"seconds": 8, "fps": 24}')
    assert state["seconds"] == 8
    assert state["step"] == DEFAULTS["step"]


def test_compute_falls_back_to_recipe_on_bad_custom_formula():
    frames, _ = compute(
        {
            "mode": "custom",
            "formula": "this is not valid",
            "seconds": 5,
            "fps": 24,
            "step": 17,
            "plus": 5,
        }
    )
    assert frames == 124
