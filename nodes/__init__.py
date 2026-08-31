import importlib.util
import sys
from pathlib import Path

_nodes_dir = Path(__file__).resolve().parent
_root = _nodes_dir.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))


def _import_node(name):
    spec = importlib.util.spec_from_file_location(
        f"artthreads_node_{name}",
        _nodes_dir / f"{name}.py",
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


_modules = [
    _import_node(n)
    for n in (
        "duration",
        "load_audio",
        "video_size",
        "longest_side",
        "monitor",
        "run_timer",
    )
]

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

for mod in _modules:
    NODE_CLASS_MAPPINGS.update(mod.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(mod.NODE_DISPLAY_NAME_MAPPINGS)
