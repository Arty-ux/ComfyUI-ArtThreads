from lib.duration_math import parse_state
from lib.timing_plan import make_timing_plan

_TIMING_DEFAULTS = {
    "sceneStart": 0.0,
    "warmup": 0.0,
    "cooldown": 0.0,
    "ensureMinContext": True,
    "sourceDuration": 0.0,
}


def _timing_options(state: dict) -> dict:
    return {
        "scene_start_seconds": float(state.get("sceneStart", _TIMING_DEFAULTS["sceneStart"])),
        "warmup_seconds": float(state.get("warmup", _TIMING_DEFAULTS["warmup"])),
        "cooldown_seconds": float(state.get("cooldown", _TIMING_DEFAULTS["cooldown"])),
        "ensure_minimum_context": bool(
            state.get("ensureMinContext", _TIMING_DEFAULTS["ensureMinContext"])
        ),
        "source_duration_seconds": float(
            state.get("sourceDuration", _TIMING_DEFAULTS["sourceDuration"])
        ),
    }


class ArtThreadsDuration:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {"DurationState": ("STRING", {"default": "{}"})},
        }

    RETURN_TYPES = ("INT", "FLOAT", "FLOAT", "FLOAT", "FLOAT", "FLOAT")
    RETURN_NAMES = (
        "frames",
        "seconds",
        "source_slice_start_seconds",
        "source_slice_duration_seconds",
        "final_trim_start_seconds",
        "final_duration_seconds",
    )
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Video"

    def run(self, DurationState="{}"):
        # H3 length must match the T8 timing plan (min-context pad + grid), not
        # a plain seconds→frames snap. Otherwise Exact Output Trim asks for
        # frames beyond what was decoded (e.g. 4s → 107 gen vs trim end 110).
        state = parse_state(DurationState)
        scene_seconds = float(state["seconds"])
        plan = make_timing_plan(
            scene_duration_seconds=scene_seconds,
            **_timing_options(state),
        )
        return (
            plan["frame_count"],
            scene_seconds,
            plan["source_slice_start_seconds"],
            plan["source_slice_duration_seconds"],
            plan["final_trim_start_seconds"],
            plan["final_duration_seconds"],
        )


NODE_CLASS_MAPPINGS = {"ArtThreadsDuration": ArtThreadsDuration}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsDuration": "Duration ArtThreads"}
