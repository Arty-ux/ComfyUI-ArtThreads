from __future__ import annotations

import os


def is_path_under(child: str, *parents: str) -> bool:
    if not child or not isinstance(child, str):
        return False
    try:
        child_abs = os.path.abspath(child)
        child_real = os.path.realpath(child)
    except (OSError, ValueError, TypeError):
        return False
    for p in parents:
        if not p or not isinstance(p, str):
            continue
        cross_drive = False
        try:
            parent_real = os.path.realpath(p)
            if os.path.commonpath([child_real, parent_real]) == parent_real:
                return True
        except ValueError:
            cross_drive = True
        except (OSError, TypeError):
            continue
        if not cross_drive:
            continue
        try:
            parent_abs = os.path.abspath(p)
            c = os.path.normcase(child_abs)
            pa = os.path.normcase(parent_abs)
            if os.path.commonpath([c, pa]) == pa:
                return True
        except (OSError, ValueError, TypeError):
            continue
    return False


def rel_is_rooted(rel) -> bool:
    if not rel or not isinstance(rel, str):
        return False
    q = rel.strip().strip('"').strip("'").strip()
    if not q:
        return False
    if q.replace("/", "\\").startswith("\\\\"):
        return True
    try:
        if os.path.splitdrive(q)[0]:
            return True
        return bool(os.path.isabs(q))
    except (ValueError, TypeError):
        return True


def comfy_roots() -> list:
    roots = []
    try:
        import folder_paths
    except Exception:
        return roots
    for getter in (
        "get_input_directory",
        "get_output_directory",
        "get_temp_directory",
    ):
        try:
            d = getattr(folder_paths, getter, None)
            if callable(d):
                v = d()
                if v:
                    roots.append(v)
        except Exception:
            continue
    return roots
