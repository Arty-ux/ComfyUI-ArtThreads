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
    assert abs(seconds - 124 / 24) < 0.001
    assert trim_dur == 5.0
    assert slice_start == 0.0
    assert slice_dur == pytest.approx(mod.make_timing_plan(0, 5.0)["source_slice_duration_seconds"])


def test_video_size_run():
    pytest.importorskip("torch")
    mod = _load_module("artthreads_video_size", "nodes/video_size.py")
    ArtThreadsVideoSize = mod.ArtThreadsVideoSize

    w, h, img = ArtThreadsVideoSize().run(
        VideoSizeState='{"size":896,"ratio":"16:9","step":32,"anchor":"center","allow_upscale":true,"resample":"auto"}'
    )
    assert (w, h) == (896, 512)
    assert tuple(img.shape) == (1, 64, 64, 3)
