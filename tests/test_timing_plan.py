import pytest

from lib.timing_plan import MIN_TRAINED_FRAMES, FPS, make_timing_plan


def test_default_5s_matches_t8_trim_outputs():
    plan = make_timing_plan(
        scene_start_seconds=0.0,
        scene_duration_seconds=5.0,
        warmup_seconds=0.0,
        cooldown_seconds=0.0,
        ensure_minimum_context=True,
        source_duration_seconds=0.0,
    )
    assert plan["frame_count"] == MIN_TRAINED_FRAMES
    assert plan["final_duration_seconds"] == 5.0
    assert plan["final_trim_start_seconds"] == pytest.approx((MIN_TRAINED_FRAMES / FPS - 5.0) / 2)
    assert plan["source_slice_start_seconds"] == pytest.approx(0.0)
    assert plan["source_slice_duration_seconds"] >= 5.0
    start = round(plan["final_trim_start_seconds"] * FPS)
    count = max(1, round(plan["final_duration_seconds"] * FPS))
    assert start + count <= plan["frame_count"]


def test_warmup_shifts_slice_start():
    plan = make_timing_plan(
        scene_start_seconds=2.0,
        scene_duration_seconds=5.0,
        warmup_seconds=1.0,
        ensure_minimum_context=False,
    )
    assert plan["final_duration_seconds"] == 5.0
    assert plan["final_trim_start_seconds"] == pytest.approx(1.0)
