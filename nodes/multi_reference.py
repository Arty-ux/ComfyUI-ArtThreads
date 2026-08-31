from __future__ import annotations

from lib.multi_reference import (
    MAX_REFERENCE_IMAGES,
    REFERENCE_IMAGES_TYPE,
    changed_token,
    load_image_tensor,
    parse_state,
    resolve_image_path,
)

HIDDEN_INPUT = "MultiReferenceState"


class ArtThreadsMultiReference:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {HIDDEN_INPUT: ("STRING", {"default": "{}"})},
        }

    RETURN_TYPES = (REFERENCE_IMAGES_TYPE, "IMAGE")
    RETURN_NAMES = ("ref_images", "image_list")
    OUTPUT_IS_LIST = (False, True)
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Image"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        st = parse_state(kwargs.get(HIDDEN_INPUT, "{}"))
        return changed_token(st.get("files", []))

    def run(self, **kwargs):
        st = parse_state(kwargs.get(HIDDEN_INPUT, "{}"))
        files = st.get("files", [])
        if not files:
            raise ValueError(
                "[ArtThreads] Multi Reference: no images selected. "
                "Add at least one with Upload, Input Folder, drag-and-drop, or paste."
            )
        if len(files) > MAX_REFERENCE_IMAGES:
            raise ValueError(
                f"[ArtThreads] Multi Reference: MiniMax H3 supports at most "
                f"{MAX_REFERENCE_IMAGES} reference images, but {len(files)} are selected."
            )

        images = []
        failed = []
        for name in files:
            path = resolve_image_path(name)
            if not path:
                failed.append(name)
                continue
            try:
                images.append(load_image_tensor(path))
            except Exception:
                failed.append(name)

        if failed:
            preview = ", ".join(failed[:3])
            extra = f" (+{len(failed) - 3} more)" if len(failed) > 3 else ""
            raise ValueError(
                f"[ArtThreads] Multi Reference: could not load: {preview}{extra}. "
                "Re-add the image from Upload or Input Folder."
            )

        return (tuple(images), images)


NODE_CLASS_MAPPINGS = {"ArtThreadsMultiReference": ArtThreadsMultiReference}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsMultiReference": "Multi Reference ArtThreads"}
