from __future__ import annotations

from lib.ltx_unpack import map_refs_to_ltx_slots
from lib.multi_reference import REFERENCE_IMAGES_TYPE


class ArtThreadsLTXUnpackReferences:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "artthreads_ref_images": (REFERENCE_IMAGES_TYPE,),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("pic1", "pic2", "pic3", "pic4", "background")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Image"

    def run(self, artthreads_ref_images):
        return map_refs_to_ltx_slots(artthreads_ref_images)


NODE_CLASS_MAPPINGS = {
    "ArtThreadsLTXUnpackReferences": ArtThreadsLTXUnpackReferences,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ArtThreadsLTXUnpackReferences": "LTX Unpack References ArtThreads",
}
