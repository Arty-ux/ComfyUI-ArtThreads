import json
import math

MAX_EXPONENT = 4000
MAX_FORMULA_LEN = 500
MAX_FPS = 1000.0
MAX_STEP = 100000
MAX_FRAMES = 1000000
MAX_SECONDS = 100000.0

DEFAULTS = {
    "seconds": 5.0,
    "fps": 24.0,
    "step": 17,
    "plus": 5,
    "minFrames": 5,
    "mode": "recipe",
    "formula": "",
}


def _safe_pow(base, exp):
    if abs(exp) > MAX_EXPONENT:
        raise ValueError("exponent too large")
    return pow(base, exp)


FORMULA_FUNCTIONS = {
    "min": min,
    "max": max,
    "abs": abs,
    "round": round,
    "pow": _safe_pow,
    "sqrt": math.sqrt,
    "ceil": math.ceil,
    "floor": math.floor,
    "log": math.log,
    "log2": math.log2,
    "log10": math.log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "int": int,
    "float": float,
}


def _num(value, fallback, lo, hi):
    try:
        out = float(value)
    except (TypeError, ValueError, OverflowError):
        return fallback
    if not math.isfinite(out):
        return fallback
    return max(lo, min(hi, out))


def snap_frames(raw, step, plus):
    step = int(step)
    plus = int(plus)
    raw = int(raw)
    if step <= 1:
        return raw
    remainder = (raw - plus) % step
    if remainder:
        raw += step - remainder
    return raw


def frames_from_seconds(seconds, fps, step, plus, min_frames):
    seconds = _num(seconds, DEFAULTS["seconds"], -MAX_SECONDS, MAX_SECONDS)
    fps = _num(fps, DEFAULTS["fps"], 0.0, MAX_FPS)
    step = int(_num(step, DEFAULTS["step"], 0, MAX_STEP))
    plus = int(_num(plus, DEFAULTS["plus"], 0, MAX_STEP))
    min_frames = int(_num(min_frames, DEFAULTS["minFrames"], 0, MAX_FRAMES))

    raw = int(round(seconds * fps))
    if raw < min_frames:
        raw = min_frames
    raw = snap_frames(raw, step, plus)
    return max(0, min(MAX_FRAMES, raw))


def frames_from_formula(formula, seconds, fps):
    if not isinstance(formula, str):
        return None
    text = formula.strip()
    if not text or len(text) > MAX_FORMULA_LEN:
        return None
    try:
        from simpleeval import simple_eval
    except ImportError:
        return None
    names = {"a": float(seconds), "seconds": float(seconds), "fps": float(fps)}
    try:
        result = simple_eval(text, names=names, functions=FORMULA_FUNCTIONS)
    except Exception:
        return None
    if isinstance(result, bool) or not isinstance(result, (int, float)):
        return None
    try:
        value = float(result)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(value):
        return None
    return max(0, min(MAX_FRAMES, int(round(value))))


def parse_state(raw):
    state = {}
    if isinstance(raw, dict):
        state = raw
    elif isinstance(raw, str) and raw.strip():
        try:
            loaded = json.loads(raw)
        except (ValueError, TypeError, RecursionError):
            loaded = None
        if isinstance(loaded, dict):
            state = loaded
    out = dict(DEFAULTS)
    for key in DEFAULTS:
        if key in state and state[key] is not None:
            out[key] = state[key]
    return out


def compute(raw_state):
    state = parse_state(raw_state)
    seconds = _num(state["seconds"], DEFAULTS["seconds"], -MAX_SECONDS, MAX_SECONDS)
    fps = _num(state["fps"], DEFAULTS["fps"], 0.0, MAX_FPS)

    frames = None
    if str(state.get("mode") or "recipe").lower() == "custom":
        frames = frames_from_formula(state.get("formula"), seconds, fps)
    if frames is None:
        frames = frames_from_seconds(
            seconds, fps, state["step"], state["plus"], state["minFrames"]
        )

    actual = (frames / fps) if fps > 0 else 0.0
    return int(frames), float(actual)
