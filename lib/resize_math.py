import json

ALLOWED_STEPS = (0, 8, 16, 32, 64)

ANCHORS = (
    "top-left",
    "top",
    "top-right",
    "left",
    "center",
    "right",
    "bottom-left",
    "bottom",
    "bottom-right",
)

RESAMPLES = ("auto", "lanczos", "bicubic", "bilinear", "nearest")

MIN_DIM = 8
MAX_DIM = 16384

DEFAULT_STATE = {
    "size": 1216,
    "ratio": "keep",
    "step": 0,
    "anchor": "center",
    "allow_upscale": True,
    "resample": "auto",
}

UI_ONLY_KEYS = ("sizes", "ratios")

_NUM_ERRORS = (TypeError, ValueError, OverflowError)


def _round_div(a, b):
    b = int(b)
    if b == 0:
        return 0
    return (int(a) + b // 2) // b


def snap_to_multiple(value, multiple):
    try:
        value = int(value)
        multiple = int(multiple)
    except _NUM_ERRORS:
        return value
    if multiple <= 1:
        return value
    return max(multiple, (value + multiple // 2) // multiple * multiple)


def parse_ratio(name):
    if not name or not isinstance(name, str):
        return None
    text = name.strip().lower()
    if text in ("keep", "", "off", "none", "original"):
        return None
    for sep in (":", "x", "/"):
        if sep in text:
            a, _, b = text.partition(sep)
            try:
                rw, rh = int(float(a.strip())), int(float(b.strip()))
            except _NUM_ERRORS:
                return None
            if rw > 0 and rh > 0:
                return (rw, rh)
            return None
    return None


def crop_rect(w, h, ratio, anchor="center"):
    w, h = int(w), int(h)
    if w <= 0 or h <= 0:
        return (0, 0, max(0, w), max(0, h))
    if not ratio:
        return (0, 0, w, h)

    rw, rh = ratio
    if w * rh > h * rw:
        ch = h
        cw = _round_div(h * rw, rh)
    else:
        cw = w
        ch = _round_div(w * rh, rw)

    cw = max(1, min(cw, w))
    ch = max(1, min(ch, h))
    x, y = _anchor_offset(anchor, w, cw, h, ch)
    return (x, y, cw, ch)


def _anchor_offset(anchor, outer_w, inner_w, outer_h, inner_h):
    a = (anchor or "center").lower()
    if "left" in a:
        x = 0
    elif "right" in a:
        x = outer_w - inner_w
    else:
        x = (outer_w - inner_w) // 2
    if "top" in a:
        y = 0
    elif "bottom" in a:
        y = outer_h - inner_h
    else:
        y = (outer_h - inner_h) // 2
    return max(0, x), max(0, y)


def target_size(cw, ch, longest, allow_upscale=True):
    cw, ch = int(cw), int(ch)
    if cw <= 0 or ch <= 0:
        return (MIN_DIM, MIN_DIM)

    try:
        longest = int(longest)
    except _NUM_ERRORS:
        longest = MIN_DIM
    if longest <= 0:
        longest = MIN_DIM

    src_longest = max(cw, ch)
    if not allow_upscale and longest > src_longest:
        longest = src_longest

    if cw >= ch:
        out_w = longest
        out_h = _round_div(longest * ch, cw)
    else:
        out_h = longest
        out_w = _round_div(longest * cw, ch)

    return (max(1, out_w), max(1, out_h))


def clamp_dims(w, h):
    return (max(MIN_DIM, min(int(w), MAX_DIM)), max(MIN_DIM, min(int(h), MAX_DIM)))


def _dims_from_ratio(longest, ratio):
    rw, rh = ratio
    if rw >= rh:
        out_w = longest
        out_h = _round_div(longest * rh, rw)
    else:
        out_h = longest
        out_w = _round_div(longest * rw, rh)
    return out_w, out_h


def compute_output_size(state):
    """Width/height from UI state alone (no source image). Used by ArtThreadsVideoSize."""
    st = normalize_state(state)
    ratio = parse_ratio(st["ratio"])
    if ratio is None:
        ratio = (16, 9)

    out_w, out_h = _dims_from_ratio(st["size"], ratio)
    step = st["step"]
    if step > 0:
        out_w = snap_to_multiple(out_w, step)
        out_h = snap_to_multiple(out_h, step)
    return clamp_dims(out_w, out_h)


def compute(in_w, in_h, state):
    st = normalize_state(state)
    in_w, in_h = int(in_w or 0), int(in_h or 0)
    if in_w <= 0 or in_h <= 0:
        return {"crop": (0, 0, 0, 0), "size": (MIN_DIM, MIN_DIM), "cropped": False}

    ratio = parse_ratio(st["ratio"])
    x, y, cw, ch = crop_rect(in_w, in_h, ratio, st["anchor"])
    out_w, out_h = target_size(cw, ch, st["size"], st["allow_upscale"])

    step = st["step"]
    if step > 0:
        out_w = snap_to_multiple(out_w, step)
        out_h = snap_to_multiple(out_h, step)

    out_w, out_h = clamp_dims(out_w, out_h)
    return {
        "crop": (x, y, cw, ch),
        "size": (out_w, out_h),
        "cropped": (cw != in_w or ch != in_h),
    }


def normalize_state(raw):
    data = raw if isinstance(raw, dict) else {}
    st = dict(DEFAULT_STATE)

    try:
        size = int(data.get("size", st["size"]))
    except _NUM_ERRORS:
        size = st["size"]
    st["size"] = max(MIN_DIM, min(size, MAX_DIM))

    ratio = data.get("ratio", st["ratio"])
    st["ratio"] = ratio if isinstance(ratio, str) and ratio.strip() else "keep"

    try:
        step = int(data.get("step", 0))
    except _NUM_ERRORS:
        step = 0
    st["step"] = step if step in ALLOWED_STEPS else 0

    anchor = data.get("anchor", st["anchor"])
    st["anchor"] = anchor if anchor in ANCHORS else "center"

    st["allow_upscale"] = bool(data.get("allow_upscale", True))

    resample = data.get("resample", st["resample"])
    st["resample"] = resample if resample in RESAMPLES else "auto"

    return st


def parse_state(raw):
    if isinstance(raw, dict):
        return normalize_state(raw)
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            loaded = json.loads(raw)
        except (ValueError, TypeError, RecursionError):
            loaded = None
        if isinstance(loaded, dict):
            return normalize_state(loaded)
    return dict(DEFAULT_STATE)


def strip_ui_keys(state):
    return {k: v for k, v in (state or {}).items() if k not in UI_ONLY_KEYS}
