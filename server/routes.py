"""ArtThreads aiohttp routes — monitor stats, load audio list, free VRAM."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
import time

import folder_paths
from aiohttp import web

from lib.monitor_stats import (
    NVIDIA_SMI_ARGS,
    gpu_extras_for,
    parse_nvidia_smi,
    parse_visible_devices,
    pct,
)

_AUDIO_EXTS = (".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".aiff", ".aif")
_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff")

_NO_STORE = {"Cache-Control": "no-store"}

_GPU_LOCK = threading.Lock()
_GPU = {"rows": [], "at": 0.0, "busy": False, "fails": 0, "off": False, "path": None}
_GPU_MIN_AGE = 0.75
_GPU_MAX_FAILS = 3


def _smi_path():
    p = _GPU.get("path")
    if p is None:
        p = shutil.which("nvidia-smi") or ""
        _GPU["path"] = p
    return p or None


def _gpu_refresh():
    rows = None
    try:
        exe = _smi_path()
        if exe:
            kwargs = {}
            flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            if flags:
                kwargs["creationflags"] = flags
            out = subprocess.run(
                [exe, *NVIDIA_SMI_ARGS],
                capture_output=True,
                text=True,
                timeout=4.0,
                **kwargs,
            )
            if out.returncode == 0:
                rows = parse_nvidia_smi(out.stdout)
    except Exception:
        rows = None

    with _GPU_LOCK:
        _GPU["busy"] = False
        if rows:
            _GPU["rows"] = rows
            _GPU["at"] = time.monotonic()
            _GPU["fails"] = 0
        else:
            _GPU["fails"] += 1
            if _GPU["fails"] >= _GPU_MAX_FAILS:
                _GPU["off"] = True
                _GPU["rows"] = []


def _gpu_rows():
    with _GPU_LOCK:
        if _GPU["off"]:
            return []
        stale = (time.monotonic() - _GPU["at"]) >= _GPU_MIN_AGE
        if stale and not _GPU["busy"]:
            _GPU["busy"] = True
            start = True
        else:
            start = False
        rows = list(_GPU["rows"])
    if start:
        try:
            threading.Thread(target=_gpu_refresh, name="artthreads-monitor-gpu", daemon=True).start()
        except Exception:
            with _GPU_LOCK:
                _GPU["busy"] = False
    return rows


def _torch_devices():
    import comfy.model_management as mm

    primary = mm.get_torch_device()
    try:
        devices = list(mm.get_all_torch_devices())
    except Exception:
        devices = []
    if not devices:
        return [primary]
    return [primary] + [d for d in devices if d != primary]


def _monitor_devices():
    out = []
    try:
        import comfy.model_management as mm

        for dev in _torch_devices():
            try:
                total, torch_total = mm.get_total_memory(dev, torch_total_too=True)
                free, torch_free = mm.get_free_memory(dev, torch_free_too=True)
                out.append({
                    "name": mm.get_torch_device_name(dev),
                    "type": getattr(dev, "type", "cuda"),
                    "index": getattr(dev, "index", None),
                    "total": int(total),
                    "used": int(total) - int(free),
                    "torchTotal": int(torch_total),
                    "torchUsed": int(torch_total) - int(torch_free),
                })
            except Exception:
                continue
    except Exception:
        pass
    return out


def _prompt_server():
    mod = sys.modules.get("server")
    if mod is None or not hasattr(mod, "PromptServer"):
        import server as mod
    return mod.PromptServer


def _list_input_files(exts):
    try:
        input_dir = folder_paths.get_input_directory()
        names = []
        for n in os.listdir(input_dir):
            if not n.lower().endswith(exts):
                continue
            try:
                if os.path.isfile(os.path.join(input_dir, n)):
                    names.append(n)
            except OSError:
                continue
        names.sort(key=lambda s: s.lower())
    except Exception:
        return None
    return names


@_prompt_server().instance.routes.get("/artthreads/api/load_audio/list")
async def api_load_audio_list(request):
    names = _list_input_files(_AUDIO_EXTS)
    if names is None:
        return web.json_response({"files": [], "error": True}, headers=_NO_STORE)
    return web.json_response({"files": names}, headers=_NO_STORE)


@_prompt_server().instance.routes.get("/artthreads/api/multi_reference/list")
async def api_multi_reference_list(request):
    names = _list_input_files(_IMAGE_EXTS)
    if names is None:
        return web.json_response({"files": [], "error": True}, headers=_NO_STORE)
    return web.json_response({"files": names}, headers=_NO_STORE)


@_prompt_server().instance.routes.get("/artthreads/api/monitor/stats")
async def api_monitor_stats(request):
    payload = {"ok": True}

    try:
        import psutil

        vm = psutil.virtual_memory()
        payload["ram"] = {
            "total": int(vm.total),
            "used": int(vm.total - vm.available),
            "pct": pct(vm.total - vm.available, vm.total),
        }
        payload["cpu"] = {"pct": float(psutil.cpu_percent(interval=None))}
        try:
            rss = psutil.Process().memory_info().rss
            payload["proc"] = {"used": int(rss), "pct": pct(rss, vm.total)}
        except Exception:
            pass
    except Exception:
        pass

    devices = _monitor_devices()
    if devices:
        visible = parse_visible_devices(os.environ.get("CUDA_VISIBLE_DEVICES"))
        payload["devices"] = gpu_extras_for(devices, _gpu_rows(), visible)
    else:
        rows = _gpu_rows()
        if rows:
            payload["devices"] = [
                {
                    "name": r.get("name") or "GPU",
                    "type": "cuda",
                    "index": r.get("index"),
                    "total": r.get("memTotal") or 0,
                    "used": r.get("memUsed") or 0,
                    "util": r.get("util"),
                    "temp": r.get("temp"),
                    "power": r.get("power"),
                }
                for r in rows
            ]

    return web.json_response(payload, headers=_NO_STORE)


@_prompt_server().instance.routes.post("/artthreads/api/duration/preview")
async def api_duration_preview(request):
    import math

    from lib.duration_math import (
        DEFAULTS,
        frames_from_formula,
        frames_from_seconds,
        MAX_FORMULA_LEN,
    )

    try:
        data = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad request"}, headers=_NO_STORE, status=400)
    if not isinstance(data, dict):
        return web.json_response({"ok": False, "error": "bad request"}, headers=_NO_STORE, status=400)

    formula = data.get("formula")
    if not isinstance(formula, str) or len(formula) > MAX_FORMULA_LEN:
        formula = ""

    def _f(key, fallback):
        try:
            value = float(data.get(key, fallback))
        except (TypeError, ValueError, OverflowError):
            return float(fallback)
        return value if math.isfinite(value) else float(fallback)

    seconds = _f("seconds", DEFAULTS["seconds"])
    fps = _f("fps", DEFAULTS["fps"])
    step = int(_f("step", DEFAULTS["step"]))
    plus = int(_f("plus", DEFAULTS["plus"]))
    min_frames = int(_f("minFrames", DEFAULTS["minFrames"]))

    frames = frames_from_formula(formula, seconds, fps)
    ok = frames is not None
    if frames is None:
        frames = frames_from_seconds(seconds, fps, step, plus, min_frames)
    actual = (frames / fps) if fps > 0 else 0.0
    return web.json_response(
        {"ok": ok, "frames": int(frames), "actual": float(actual)},
        headers=_NO_STORE,
    )


@_prompt_server().instance.routes.get("/artthreads/api/sounds")
async def api_sounds_list(request):
    return web.json_response({"sounds": []}, headers=_NO_STORE)


@_prompt_server().instance.routes.post("/artthreads/api/monitor/free_vram")
async def api_monitor_free_vram(request):
    """Unload models and free node cache — same flags as ComfyUI's /free route."""
    try:
        queue = _prompt_server().instance.prompt_queue
        queue.set_flag("unload_models", True)
        queue.set_flag("free_memory", True)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, headers=_NO_STORE, status=500)
    return web.json_response({"ok": True}, headers=_NO_STORE)
