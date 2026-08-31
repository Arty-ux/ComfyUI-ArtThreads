#!/usr/bin/env python3
"""ArtThreads smoke checks: lib math, workflow wiring, optional ComfyUI node load."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

WORKFLOW = Path(
    r"C:\Users\artio\Desktop\Comfy UI workflows\MiniMax H3\MinimaxH3\ArtThreads_MultiReference_AudioSync_v1.json"
)
REFERENCE = Path(
    r"C:\Users\artio\Desktop\Comfy UI workflows\MiniMax H3\MinimaxH3\+5 (2) - multi-audio-source-MiniMax_H3_MultiReference_AudioSync_v17_fixed_3_audio_refs.json"
)

PASS = 0
FAIL = 0
SKIP = 0


def ok(name: str) -> None:
    global PASS
    PASS += 1
    print(f"  OK  {name}")


def fail(name: str, detail: str = "") -> None:
    global FAIL
    FAIL += 1
    line = f" FAIL {name}"
    if detail:
        line += f" — {detail}"
    print(line)


def skip(name: str, reason: str) -> None:
    global SKIP
    SKIP += 1
    print(f" SKIP {name} — {reason}")


def section(title: str) -> None:
    print(f"\n{title}")


def _load(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def check_lib_math() -> None:
    section("Lib math (896x512 gen, 1344x768 upscale, 5s duration)")

    from lib.resize_math import compute, compute_output_size
    from lib.duration_math import frames_from_seconds, DEFAULTS

    gen = compute_output_size({
        "size": 896, "ratio": "16:9", "step": 32,
        "anchor": "center", "allow_upscale": True, "resample": "auto",
    })
    if gen == (896, 512):
        ok("generation size 896x512")
    else:
        fail("generation size 896x512", str(gen))

    upscale = compute(896, 512, {"size": 1344, "ratio": "keep", "step": 32, "allow_upscale": True})
    if upscale["size"] == (1344, 768) and not upscale["cropped"]:
        ok("upscale 896x512 -> 1344x768 keep ratio")
    else:
        fail("upscale keep ratio", str(upscale))

    frames = frames_from_seconds(5, DEFAULTS["fps"], DEFAULTS["step"], DEFAULTS["plus"], DEFAULTS["minFrames"])
    if frames == 124:
        ok("duration 5s -> 124 frames (H3 snap)")
    else:
        fail("duration 5s frames", f"got {frames}")


def check_workflow() -> None:
    section("Workflow wiring (ArtThreads_MultiReference_AudioSync_v1.json)")

    if not WORKFLOW.is_file():
        fail("workflow file exists")
        return
    ok("workflow file exists")

    if not REFERENCE.is_file():
        fail("reference +5 (2) exists")
    else:
        ref = _load(REFERENCE)
        if any(n["type"].startswith("ArtThreads") for n in ref["nodes"]):
            fail("reference +5 (2) unchanged", "contains ArtThreads nodes")
        else:
            ok("reference +5 (2) unchanged")

    wf = _load(WORKFLOW)
    nodes = {n["id"]: n for n in wf["nodes"]}
    links = {row[0]: row for row in wf["links"]}

    expected_types = {
        "ArtThreadsVideoSize", "ArtThreadsLongestSide", "ArtThreadsLoadAudio",
        "ArtThreadsDuration", "ArtThreadsMonitor", "ArtThreadsRunTimer",
    }
    found = {n["type"] for n in wf["nodes"]}
    if expected_types <= found:
        ok("all 6 ArtThreads node types present")
    else:
        fail("ArtThreads nodes", f"missing {expected_types - found}")

    n26 = nodes.get(26, {})
    if n26.get("type") == "ArtThreadsVideoSize" and not n26.get("inputs"):
        ok("node 26 VideoSize, no image input")
    else:
        fail("node 26 VideoSize wiring")

    state26 = (n26.get("properties") or {}).get("videoSizeState") or {}
    if state26.get("size") == 896 and state26.get("ratio") == "16:9":
        ok("node 26 state 896 / 16:9")
    else:
        fail("node 26 state", str(state26))

    if links.get(41, [None] * 5)[1:5] == [26, 0, 22, 10]:
        ok("link 41 width -> H3")
    else:
        fail("link 41")
    if links.get(42, [None] * 5)[1:5] == [26, 1, 22, 11]:
        ok("link 42 height -> H3")
    else:
        fail("link 42")

    n27 = nodes.get(27, {})
    ls = (n27.get("properties") or {}).get("longestSideState") or {}
    if n27.get("type") == "ArtThreadsLongestSide" and ls.get("size") == 1344 and ls.get("ratio") == "keep":
        ok("node 27 LongestSide 1344 keep")
    else:
        fail("node 27 upscale config")

    if 32 not in links and links.get(53, [None] * 5)[1:5] == [34, 0, 22, 12]:
        ok("phase B: Duration.frames -> H3 length (link 53, no link 32)")
    else:
        fail("phase B duration → length wiring")

    if 14 not in nodes:
        ok("T8 Duration Planner removed (node 14)")
    else:
        fail("T8 Duration Planner still present")

    for lid, nid in [(54, 13), (55, 29), (56, 30), (57, 31)]:
        if links.get(lid, [None] * 5)[1:5] != [34, 1, nid, 0]:
            fail(f"Duration.seconds -> LoadAudio node {nid} (link {lid})")
            break
    else:
        ok("Duration.seconds -> all 4 LoadAudio nodes")

    for lid, slot, target in [(22, 4, 15), (23, 5, 15), (45, 2, 23), (46, 3, 23)]:
        row = links.get(lid)
        if not row or row[1:5] != [34, slot, target, row[4]]:
            fail(f"Duration timing output link {lid}")
            break
    else:
        ok("Duration -> trim/slice links 22/23/45/46")

    if links.get(28, [None] * 5)[1:5] == [21, 0, 22, 3]:
        ok("ref images link 28 only to H3")
    else:
        fail("ref images wiring")

    for lid in (22, 23, 45, 46):
        if links.get(lid, [None] * 6)[1] != 34:
            fail(f"T8 trim link {lid}")
            break
    else:
        ok("trim/slice links 22/23/45/46 from Duration")

    extra = wf.get("extra") or {}
    if extra.get("generation_resolution") == {"width": 896, "height": 512}:
        ok("metadata generation_resolution")
    else:
        fail("metadata generation_resolution")
    if extra.get("final_upscale_resolution") == {"width": 1344, "height": 768}:
        ok("metadata final_upscale_resolution")
    else:
        fail("metadata final_upscale_resolution")


def check_nodes_optional() -> None:
    section("Python nodes (requires torch + ComfyUI)")

    try:
        import torch  # noqa: F401
    except ImportError:
        skip("node import + run", "torch not installed in this Python")
        return

    comfy = ROOT.parents[1]
    if str(comfy) not in sys.path:
        sys.path.insert(0, str(comfy))

    try:
        from nodes.duration import ArtThreadsDuration
        from nodes.video_size import ArtThreadsVideoSize

        frames, seconds = ArtThreadsDuration().run(
            DurationState='{"seconds":5,"fps":24,"step":17,"plus":5,"minFrames":5,"mode":"recipe"}'
        )[:2]
        if frames == 124:
            ok("ArtThreadsDuration.run 5s -> 124 frames")
        else:
            fail("ArtThreadsDuration.run", f"frames={frames}")

        w, h, img = ArtThreadsVideoSize().run(
            VideoSizeState='{"size":896,"ratio":"16:9","step":32,"anchor":"center","allow_upscale":true,"resample":"auto"}'
        )
        if (w, h) == (896, 512):
            ok("ArtThreadsVideoSize.run -> 896x512")
        else:
            fail("ArtThreadsVideoSize.run", f"{w}x{h}")
    except Exception as exc:
        fail("node run", str(exc))


def main() -> int:
    print("ArtThreads smoke test")
    check_lib_math()
    check_workflow()
    check_nodes_optional()

    print(f"\nResult: {PASS} passed, {FAIL} failed, {SKIP} skipped")
    if FAIL:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
