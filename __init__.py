if __package__:

    import sys

    from pathlib import Path



    _root = Path(__file__).resolve().parent

    if str(_root) not in sys.path:

        sys.path.insert(0, str(_root))

    from . import server  # noqa: F401 — side-effect route registration

    from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

else:

    import importlib.util

    from pathlib import Path

    import sys



    _root = Path(__file__).resolve().parent

    if str(_root) not in sys.path:

        sys.path.insert(0, str(_root))



    _spec = importlib.util.spec_from_file_location(

        "artthreads_nodes",

        _root / "nodes" / "__init__.py",

    )

    _nodes = importlib.util.module_from_spec(_spec)

    sys.modules[_spec.name] = _nodes

    assert _spec.loader is not None

    _spec.loader.exec_module(_nodes)

    NODE_CLASS_MAPPINGS = _nodes.NODE_CLASS_MAPPINGS

    NODE_DISPLAY_NAME_MAPPINGS = _nodes.NODE_DISPLAY_NAME_MAPPINGS



    _srv_spec = importlib.util.spec_from_file_location(

        "artthreads_server",

        _root / "server" / "__init__.py",

        submodule_search_locations=[str(_root / "server")],

    )

    _srv = importlib.util.module_from_spec(_srv_spec)

    sys.modules[_srv_spec.name] = _srv

    assert _srv_spec.loader is not None

    _srv_spec.loader.exec_module(_srv)



WEB_DIRECTORY = "./web"



__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

