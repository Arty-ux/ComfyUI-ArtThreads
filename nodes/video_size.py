import json

import torch

from lib.resize_math import DEFAULT_STATE, compute_output_size, parse_state


def _placeholder_image(width, height):
    w = max(1, min(int(width), 64))
    h = max(1, min(int(height), 64))
    return torch.zeros(1, h, w, 3)


class ArtThreadsVideoSize:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "VideoSizeState": ("STRING", {"default": json.dumps(DEFAULT_STATE)}),
            },
        }

    RETURN_TYPES = ("INT", "INT", "IMAGE")
    RETURN_NAMES = ("width", "height", "image")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Video"

    def run(self, VideoSizeState=""):
        state = parse_state(VideoSizeState)
        out_w, out_h = compute_output_size(state)
        return (
            out_w,
            out_h,
            _placeholder_image(out_w, out_h),
        )


NODE_CLASS_MAPPINGS = {"ArtThreadsVideoSize": ArtThreadsVideoSize}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsVideoSize": "Video Size ArtThreads"}
