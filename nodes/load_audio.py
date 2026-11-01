from __future__ import annotations

import json
import os

import folder_paths

from lib.audio_window import apply_window, plan_window, window_report
from lib.path_guard import comfy_roots, is_path_under, rel_is_rooted

HIDDEN_INPUT = "LoadAudioState"
MAX_WINDOW_S = 3600.0


def _decode(path):
    try:
        from comfy_extras.nodes_audio import load as _core_load
        return _core_load(path)
    except Exception:
        import torchaudio
        return torchaudio.load(path)


def _resolve(name):
    if not name or not isinstance(name, str):
        return None
    bare = name.split(" [")[0] if " [" in name else name
    if rel_is_rooted(bare):
        return None
    try:
        path = folder_paths.get_annotated_filepath(name)
    except Exception:
        return None
    roots = comfy_roots()
    if not roots or not is_path_under(path, *roots):
        return None
    if not os.path.isfile(path):
        return None
    return path


def _state(raw):
    try:
        st = json.loads(raw or "{}")
    except Exception:
        return {}
    return st if isinstance(st, dict) else {}


class ArtThreadsLoadAudio:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "seconds": ("FLOAT", {
                    "forceInput": True,
                    "tooltip": "Window length in seconds. Wire from Duration ArtThreads seconds output, "
                               "or leave unconnected to use settings on the node.",
                }),
            },
            "hidden": {HIDDEN_INPUT: ("STRING", {"default": "{}"})},
        }

    RETURN_TYPES = ("AUDIO",)
    RETURN_NAMES = ("audio",)
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Audio"

    @classmethod
    def IS_CHANGED(cls, seconds=None, **kwargs):
        st = _state(kwargs.get(HIDDEN_INPUT, "{}"))
        path = _resolve(st.get("file", ""))
        if not path:
            return ""
        try:
            s = os.stat(path)
            return f"{s.st_mtime_ns}:{s.st_size}"
        except OSError:
            return ""

    def run(self, seconds=None, **kwargs):
        st = _state(kwargs.get(HIDDEN_INPUT, "{}"))
        name = st.get("file", "")
        path = _resolve(name)
        if not path:
            raise ValueError(
                "[ArtThreads] Load Audio: no usable sound file selected"
                + (f" ({name!r} was not found in ComfyUI's input folder)" if name else "")
                + ". Pick one on the node, or use its Upload button."
            )

        try:
            waveform, sample_rate = _decode(path)
        except Exception as exc:
            raise ValueError(
                f"[ArtThreads] Load Audio: {os.path.basename(path)!r} could not be read as audio "
                f"({type(exc).__name__}: {exc})"
            ) from exc
        if waveform.ndim == 2:
            waveform = waveform.unsqueeze(0)

        if seconds is None:
            want = 0.0 if st.get("whenUnwired", "whole") == "whole" else st.get("length", 0.0)
        else:
            want = seconds

        try:
            want = float(want)
            if want != want:
                want = 0.0
        except (TypeError, ValueError):
            want = 0.0

        have_s = waveform.shape[-1] / float(sample_rate or 1)
        if want > MAX_WINDOW_S and want > have_s:
            raise ValueError(
                f"[ArtThreads] Load Audio: asked for {want:.0f}s but {os.path.basename(path)!r} "
                f"is only {have_s:.0f}s long (max padded window {MAX_WINDOW_S:.0f}s)."
            )

        plan = plan_window(waveform.shape[-1], sample_rate, st.get("start", 0.0), want)
        if plan["want"] <= 0:
            raise ValueError(
                f"[ArtThreads] Load Audio: selection is empty. Start {st.get('start', 0.0):.2f}s "
                f"is at or past the end of {os.path.basename(path)!r} ({have_s:.2f}s)."
            )

        # Free-trim mode only when the wired output is longer than (or equal
        # to) the file: the waveform selection is the SOURCE region, and a
        # shorter explicit length is taken then padded up to `want`. When the
        # wire is shorter than the file, length is locked to the wire and the
        # user's start just places that window - do not cap take by a stale
        # shorter length left over from a previous free-trim.
        if (
            seconds is not None
            and st.get("whenUnwired") == "length"
            and want >= have_s - 0.01
        ):
            try:
                src_s = float(st.get("length") or 0.0)
            except (TypeError, ValueError):
                src_s = 0.0
            if src_s == src_s and src_s > 0:
                max_take = int(round(src_s * float(sample_rate or 1)))
                if max_take < plan["take"]:
                    plan = {
                        **plan,
                        "take": max(0, max_take),
                        "fill": plan["want"] - max(0, max_take),
                    }

        when_short = "loop" if st.get("whenShort") == "loop" else "silence"
        out = apply_window(waveform, plan, when_short)
        rep = window_report(plan, sample_rate)

        if rep["short"]:
            mode = "looped" if when_short == "loop" and rep["take_s"] > 0 else "filled with silence"
            print(
                f"[ArtThreads] Load Audio: wanted {rep['want_s']:.2f}s from {rep['start_s']:.2f}s "
                f"but only {rep['take_s']:.2f}s available; {rep['fill_s']:.2f}s {mode}."
            )

        return {
            "ui": {"artthreads_load_audio": [{
                "file": os.path.basename(path),
                "start": round(rep["start_s"], 3),
                "length": round(rep["want_s"], 3),
                "taken": round(rep["take_s"], 3),
                "filled": round(rep["fill_s"], 3),
                "short": rep["short"],
                "mode": when_short,
                "wired": seconds is not None,
            }]},
            "result": ({"waveform": out, "sample_rate": sample_rate},),
        }


NODE_CLASS_MAPPINGS = {"ArtThreadsLoadAudio": ArtThreadsLoadAudio}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsLoadAudio": "Load Audio ArtThreads"}
