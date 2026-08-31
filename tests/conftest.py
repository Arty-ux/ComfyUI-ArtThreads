import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMFYUI = ROOT.parents[1]
if str(COMFYUI) not in sys.path:
    sys.path.insert(0, str(COMFYUI))
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))


def pytest_configure(config):
    """Keep lib imports working without loading ComfyUI-ArtThreads/__init__.py (needs torch)."""
    import types

    init_file = ROOT / "__init__.py"
    if not init_file.is_file():
        return
    key = f"artthreads_pkg_stub::{ROOT}"
    if key in sys.modules:
        return
    stub = types.ModuleType(key)
    stub.__file__ = str(init_file)
    stub.__path__ = [str(ROOT)]
    sys.modules[key] = stub
    for name in ("__init__", "ComfyUI-ArtThreads"):
        if name not in sys.modules:
            sys.modules[name] = stub
