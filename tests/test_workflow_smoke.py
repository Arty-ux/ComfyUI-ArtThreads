"""Smoke checks for ArtThreads_MultiReference_AudioSync_v1.json wiring."""

from __future__ import annotations

import json
from pathlib import Path

WORKFLOW = Path(
    r"C:\Users\artio\Desktop\Comfy UI workflows\MiniMax H3\MinimaxH3\ArtThreads_MultiReference_AudioSync_v1.json"
)
REFERENCE = Path(
    r"C:\Users\artio\Desktop\Comfy UI workflows\MiniMax H3\MinimaxH3\+5 (2) - multi-audio-source-MiniMax_H3_MultiReference_AudioSync_v17_fixed_3_audio_refs.json"
)


def _load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _node_map(wf: dict) -> dict[int, dict]:
    return {n["id"]: n for n in wf["nodes"]}


def _links_by_id(wf: dict) -> dict[int, list]:
    return {row[0]: row for row in wf["links"]}


def test_reference_file_unchanged():
    assert REFERENCE.is_file()
    ref = _load(REFERENCE)
    assert ref["nodes"][0]["type"] != "ArtThreadsVideoSize"
    assert not any(n["type"].startswith("ArtThreads") for n in ref["nodes"])


def test_workflow_artthreads_nodes_present():
    wf = _load(WORKFLOW)
    types = {n["type"] for n in wf["nodes"]}
    expected = {
        "ArtThreadsVideoSize",
        "ArtThreadsLongestSide",
        "ArtThreadsLoadAudio",
        "ArtThreadsDuration",
        "ArtThreadsMonitor",
        "ArtThreadsRunTimer",
    }
    assert expected <= types


def test_generation_size_wiring():
    wf = _load(WORKFLOW)
    nodes = _node_map(wf)
    links = _links_by_id(wf)

    n26 = nodes[26]
    assert n26["type"] == "ArtThreadsVideoSize"
    assert n26.get("inputs") == []
    state = n26["properties"].get("videoSizeState") or n26["properties"].get("longestSideState")
    assert state["size"] == 896
    assert state["ratio"] == "16:9"

    assert links[41][1:5] == [26, 0, 22, 10]
    assert links[42][1:5] == [26, 1, 22, 11]


def test_upscale_wiring():
    wf = _load(WORKFLOW)
    nodes = _node_map(wf)
    links = _links_by_id(wf)

    n27 = nodes[27]
    assert n27["type"] == "ArtThreadsLongestSide"
    assert n27["inputs"][0]["link"] == 43
    assert links[43][1:5] == [15, 0, 27, 0]
    assert links[44][1:5] == [27, 0, 18, 0]
    state = n27["properties"]["longestSideState"]
    assert state["size"] == 1344
    assert state["ratio"] == "keep"
    for out in n27["outputs"]:
        if out["name"] in ("width", "height"):
            assert out.get("links") in (None, [])


def test_duration_phase_b_wiring():
    wf = _load(WORKFLOW)
    nodes = _node_map(wf)
    links = _links_by_id(wf)

    assert 14 not in nodes
    assert "MiniMaxH3DurationPlannerT8" not in {n["type"] for n in wf["nodes"]}
    assert 32 not in links
    assert 58 not in links
    assert links[53][1:5] == [34, 0, 22, 12]
    for lid, load_id in [(54, 13), (55, 29), (56, 30), (57, 31)]:
        assert links[lid][1:5] == [34, 1, load_id, 0]
    for lid, slot in [(22, 4), (23, 5), (45, 2), (46, 3)]:
        assert links[lid][1:5] == [34, slot, links[lid][3], links[lid][4]]


def test_ref_images_not_connected_to_size():
    wf = _load(WORKFLOW)
    nodes = _node_map(wf)
    links = _links_by_id(wf)

    assert links[28][1:5] == [21, 0, 22, 3]
    n21_out = nodes[21]["outputs"][0]["links"]
    assert n21_out == [28]
    for lid in (41, 42, 43):
        assert links[lid][1] != 21


def test_t8_trim_links_from_duration():
    wf = _load(WORKFLOW)
    links = _links_by_id(wf)
    for lid, slot, target in [(22, 4, 15), (23, 5, 15), (45, 2, 23), (46, 3, 23)]:
        row = links[lid]
        assert row[1:5] == [34, slot, target, row[4]]


def test_extra_metadata():
    wf = _load(WORKFLOW)
    extra = wf["extra"]
    assert extra["generation_resolution"] == {"width": 896, "height": 512}
    assert extra["final_upscale_resolution"] == {"width": 1344, "height": 768}
    assert extra["postprocess"]["method"] == "ArtThreadsLongestSide"
    assert extra["postprocess"]["target_longest_side"] == 1344
