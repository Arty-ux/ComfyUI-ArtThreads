"""Pure helpers for Multi Reference ArtThreads — parse, resolve, load."""

from __future__ import annotations

import json
import os

from lib.path_guard import comfy_roots, is_path_under, rel_is_rooted

MAX_REFERENCE_IMAGES = 9
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff")

REFERENCE_IMAGES_TYPE = "ARTTHREADS_H3_REFERENCE_IMAGES"


def parse_state(raw) -> dict:
    try:
        st = json.loads(raw or "{}")
    except Exception:
        return {"files": []}
    if not isinstance(st, dict):
        return {"files": []}
    files = st.get("files", [])
    if not isinstance(files, list):
        files = []
    out = []
    for item in files:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return {"files": out}


def resolve_image_path(name: str):
    if not name or not isinstance(name, str):
        return None
    bare = name.split(" [")[0] if " [" in name else name
    if rel_is_rooted(bare):
        return None
    try:
        import folder_paths

        path = folder_paths.get_annotated_filepath(name)
    except Exception:
        return None
    roots = comfy_roots()
    if not roots or not is_path_under(path, *roots):
        return None
    if not os.path.isfile(path):
        return None
    return path


def load_image_tensor(path: str):
    import numpy as np
    import torch
    from PIL import Image, ImageOps

    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image_np = np.asarray(image, dtype=np.float32) / 255.0
    return torch.from_numpy(image_np)[None, ...]


def changed_token(files) -> str:
    parts = []
    for name in files or []:
        path = resolve_image_path(name)
        if not path:
            parts.append(f"{name}:missing")
            continue
        try:
            s = os.stat(path)
            parts.append(f"{name}:{s.st_mtime_ns}:{s.st_size}")
        except OSError:
            parts.append(f"{name}:missing")
    return "|".join(parts)


def bundle_to_stock_ref_images(ref_images):
    """Convert ARTTHREADS_H3_REFERENCE_IMAGES tuple/list → stock {ref_image_i: tensor}."""
    if ref_images is None:
        return None
    if not isinstance(ref_images, (tuple, list)):
        raise TypeError(
            "[ArtThreads] ref_images must come from Multi Reference ArtThreads "
            f"(got {type(ref_images).__name__})."
        )
    count = len(ref_images)
    if count == 0:
        raise ValueError("[ArtThreads] The connected reference-image bundle is empty.")
    if count > MAX_REFERENCE_IMAGES:
        raise ValueError(
            f"[ArtThreads] MiniMax H3 supports at most {MAX_REFERENCE_IMAGES} "
            f"reference images, but {count} were connected."
        )
    stock_inputs = {}
    for index, image in enumerate(ref_images):
        try:
            import torch

            is_tensor = isinstance(image, torch.Tensor)
        except Exception:
            is_tensor = False
        if not is_tensor:
            raise TypeError(
                f"[ArtThreads] Reference image {index + 1} is not an IMAGE tensor."
            )
        if (
            image.ndim != 4
            or image.shape[0] != 1
            or image.shape[1] <= 0
            or image.shape[2] <= 0
            or image.shape[3] < 3
        ):
            raise ValueError(
                f"[ArtThreads] Reference image {index + 1} must have shape "
                f"[1, H, W, C>=3], but got {tuple(image.shape)}."
            )
        stock_inputs[f"ref_image_{index}"] = image
    return stock_inputs
