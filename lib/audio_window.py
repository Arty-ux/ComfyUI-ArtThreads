from __future__ import annotations

_MAX_SECONDS = 86400.0


def _as_float(v, default=0.0) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    if f != f or f in (float("inf"), float("-inf")):
        return default
    if f > _MAX_SECONDS or f < -_MAX_SECONDS:
        return default
    return f


def plan_window(total_samples, sample_rate, start_s, duration_s) -> dict:
    total = max(0, int(total_samples or 0))
    try:
        sr = int(sample_rate or 0)
    except (TypeError, ValueError):
        sr = 0
    if sr <= 0:
        return {"start": 0, "want": total, "take": total, "fill": 0}

    start_s = max(0.0, _as_float(start_s))
    start = int(round(start_s * sr))
    if start > total:
        start = total

    avail = total - start
    dur = _as_float(duration_s)
    want = avail if dur <= 0 else int(round(dur * sr))
    if want < 0:
        want = 0

    take = min(want, avail)
    return {"start": start, "want": want, "take": take, "fill": want - take}


def apply_window(waveform, plan: dict, when_short: str = "silence"):
    import torch

    want = int(plan.get("want", 0))
    if want <= 0:
        return waveform[..., :0]

    start = int(plan.get("start", 0))
    take = int(plan.get("take", 0))
    piece = waveform[..., start : start + take]
    fill = want - take
    if fill <= 0:
        return piece

    if when_short == "loop" and take > 0:
        idx = torch.arange(fill, device=piece.device) % take
        return torch.cat([piece, piece.index_select(-1, idx)], dim=-1)

    pad = torch.zeros(
        tuple(waveform.shape[:-1]) + (fill,),
        dtype=waveform.dtype,
        device=waveform.device,
    )
    return torch.cat([piece, pad], dim=-1) if take > 0 else pad


def window_report(plan: dict, sample_rate) -> dict:
    try:
        sr = int(sample_rate or 0)
    except (TypeError, ValueError):
        sr = 0
    if sr <= 0:
        return {"start_s": 0.0, "want_s": 0.0, "take_s": 0.0, "fill_s": 0.0, "short": False}
    return {
        "start_s": plan.get("start", 0) / sr,
        "want_s": plan.get("want", 0) / sr,
        "take_s": plan.get("take", 0) / sr,
        "fill_s": plan.get("fill", 0) / sr,
        "short": plan.get("fill", 0) > 0,
    }
