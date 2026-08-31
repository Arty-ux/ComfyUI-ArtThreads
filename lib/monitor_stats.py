NVIDIA_SMI_FIELDS = (
    "index",
    "name",
    "utilization.gpu",
    "memory.used",
    "memory.total",
    "temperature.gpu",
    "power.draw",
)

NVIDIA_SMI_ARGS = (
    "--query-gpu=" + ",".join(NVIDIA_SMI_FIELDS),
    "--format=csv,noheader,nounits",
)

_MIB = 1024 * 1024


def _num(text):
    s = (text or "").strip()
    if not s or s.startswith("["):
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _int(text):
    v = _num(text)
    return None if v is None else int(v)


def parse_nvidia_smi(text):
    out = []
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < len(NVIDIA_SMI_FIELDS):
            continue
        idx = _int(parts[0])
        if idx is None:
            continue
        mem_used = _num(parts[3])
        mem_total = _num(parts[4])
        out.append(
            {
                "index": idx,
                "name": parts[1] or "GPU",
                "util": _num(parts[2]),
                "memUsed": None if mem_used is None else int(mem_used * _MIB),
                "memTotal": None if mem_total is None else int(mem_total * _MIB),
                "temp": _num(parts[5]),
                "power": _num(parts[6]),
            }
        )
    return out


def pct(used, total):
    try:
        u = float(used)
        t = float(total)
    except (TypeError, ValueError):
        return None
    if not (t > 0):
        return None
    if u < 0:
        u = 0.0
    if u > t:
        u = t
    return (u / t) * 100.0


def parse_visible_devices(env_value):
    if env_value is None:
        return None
    s = str(env_value).strip()
    if not s:
        return None
    out = []
    for tok in s.split(","):
        tok = tok.strip()
        try:
            i = int(tok)
        except (TypeError, ValueError):
            return []
        if i < 0:
            return []
        out.append(i)
    return out


def gpu_extras_for(devices, smi_rows, visible=None):
    by_index = {}
    for row in smi_rows or []:
        if isinstance(row, dict) and row.get("index") is not None:
            by_index.setdefault(int(row["index"]), row)
    devices = devices or []
    out = []
    for dev in devices:
        d = dict(dev)
        idx = d.get("index")
        phys = None
        if isinstance(idx, int):
            if visible is None:
                phys = idx
            elif visible and 0 <= idx < len(visible):
                phys = visible[idx]
        row = by_index.get(phys) if isinstance(phys, int) else None
        if (
            row is None
            and isinstance(idx, int)
            and visible == []
            and len(devices) == 1
            and len(by_index) == 1
        ):
            row = next(iter(by_index.values()))
        if row:
            d["util"] = row.get("util")
            d["temp"] = row.get("temp")
            d["power"] = row.get("power")
            if row.get("memUsed") is not None and row.get("memTotal"):
                d["cardUsed"] = row["memUsed"]
                d["cardTotal"] = row["memTotal"]
        out.append(d)
    return out
