import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _load_module(name, rel_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_node_mappings():
    pytest.importorskip("torch")
    pkg = _load_module("artthreads_nodes", "nodes/__init__.py")
    NODE_CLASS_MAPPINGS = pkg.NODE_CLASS_MAPPINGS
    NODE_DISPLAY_NAME_MAPPINGS = pkg.NODE_DISPLAY_NAME_MAPPINGS
    expected = {
        "ArtThreadsDuration",
        "ArtThreadsLoadAudio",
        "ArtThreadsMultiReference",
        "ArtThreadsVideoSize",
        "ArtThreadsLongestSide",
        "ArtThreadsMonitor",
        "ArtThreadsRunTimer",
    }
    assert expected == set(NODE_CLASS_MAPPINGS)
    assert expected == set(NODE_DISPLAY_NAME_MAPPINGS)


def test_duration_run():
    mod = _load_module("artthreads_duration", "nodes/duration.py")
    ArtThreadsDuration = mod.ArtThreadsDuration

    out = ArtThreadsDuration().run(
        DurationState='{"seconds":5,"fps":24,"step":17,"plus":5,"minFrames":5,"mode":"recipe"}'
    )
    frames, seconds, slice_start, slice_dur, trim_start, trim_dur = out
    assert frames == 124
    assert seconds == 5.0
    assert trim_dur == 5.0
    assert slice_start == 0.0
    assert end_ok(frames, trim_start, trim_dur)


def end_ok(frame_count, trim_start, trim_dur, fps=24.0):
    start = round(trim_start * fps)
    count = max(1, round(trim_dur * fps))
    return start + count <= frame_count


def test_duration_4s_trim_fits_generated_frames():
    """Regression: plain H3 snap of 4s is 107 frames; trim needs padded context."""
    mod = _load_module("artthreads_duration_4s", "nodes/duration.py")
    out = mod.ArtThreadsDuration().run(
        DurationState='{"seconds":4,"fps":24,"step":17,"plus":5,"minFrames":5,"mode":"recipe"}'
    )
    frames, seconds, _ss, _sd, trim_start, trim_dur = out
    assert seconds == 4.0
    assert frames >= 124
    assert end_ok(frames, trim_start, trim_dur)


def test_video_size_run():
    pytest.importorskip("torch")
    mod = _load_module("artthreads_video_size", "nodes/video_size.py")
    ArtThreadsVideoSize = mod.ArtThreadsVideoSize

    w, h, img = ArtThreadsVideoSize().run(
        VideoSizeState='{"size":896,"ratio":"16:9","step":32,"anchor":"center","allow_upscale":true,"resample":"auto"}'
    )
    assert (w, h) == (896, 512)
    assert tuple(img.shape) == (1, 64, 64, 3)
