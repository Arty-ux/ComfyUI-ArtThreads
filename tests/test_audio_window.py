import pytest

torch = pytest.importorskip("torch")

from lib.audio_window import apply_window, plan_window, window_report


def test_plan_window_full_clip_when_duration_zero():
    plan = plan_window(48000, 24000, 0, 0)
    assert plan == {"start": 0, "want": 48000, "take": 48000, "fill": 0}


def test_plan_window_slice_and_fill():
    plan = plan_window(48000, 24000, 1.0, 3.0)
    assert plan["start"] == 24000
    assert plan["want"] == 72000
    assert plan["take"] == 24000
    assert plan["fill"] == 48000


def test_apply_window_pads_with_silence():
    waveform = torch.ones(1, 1, 1000)
    plan = {"start": 0, "want": 1500, "take": 1000, "fill": 500}
    out = apply_window(waveform, plan, when_short="silence")
    assert out.shape[-1] == 1500
    assert out[..., :1000].eq(1).all()
    assert out[..., 1000:].eq(0).all()


def test_apply_window_loops_short_segment():
    waveform = torch.tensor([[[1.0, 2.0, 3.0]]])
    plan = {"start": 0, "want": 7, "take": 3, "fill": 4}
    out = apply_window(waveform, plan, when_short="loop")
    assert out.shape[-1] == 7
    assert out[0, 0, :7].tolist() == [1.0, 2.0, 3.0, 1.0, 2.0, 3.0, 1.0]


def test_window_report_seconds():
    report = window_report({"start": 24000, "want": 72000, "take": 48000, "fill": 24000}, 24000)
    assert report["start_s"] == pytest.approx(1.0)
    assert report["want_s"] == pytest.approx(3.0)
    assert report["short"] is True
