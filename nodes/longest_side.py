import json

import numpy as np
import torch
from PIL import Image

from lib.resize_math import DEFAULT_STATE, MIN_DIM, compute, parse_state


def _pick_resample(mode: str, factor: float):
    table = {
        "nearest": Image.NEAREST,
        "bilinear": Image.BILINEAR,
        "bicubic": Image.BICUBIC,
        "lanczos": Image.LANCZOS,
    }
    if mode in table:
        return table[mode]
    return Image.LANCZOS if factor < 1.0 else Image.BILINEAR


def _tensor_to_pils(image_t):
    arr = (image_t.clamp(0, 1).cpu().numpy() * 255.0).round().astype(np.uint8)
    out = []
    for frame in arr:
        if frame.ndim == 2:
            frame = np.stack([frame] * 3, axis=-1)
        elif frame.shape[-1] >= 3:
            frame = frame[..., :3]
        else:
            frame = np.repeat(frame[..., :1], 3, axis=-1)
        out.append(Image.fromarray(frame, "RGB"))
    return out


class ArtThreadsLongestSide:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
            "hidden": {
                "LongestSideState": ("STRING", {"default": json.dumps(DEFAULT_STATE)}),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT")
    RETURN_NAMES = ("image", "width", "height")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Video"

    def run(self, image, LongestSideState=""):
        state = parse_state(LongestSideState)
        frames = _tensor_to_pils(image)

        if not frames:
            print("[ArtThreadsLongestSide] empty image batch; passing through unchanged")
            return {
                "ui": {"artthreads_longest_side": [{
                    "in_w": 0, "in_h": 0, "out_w": 0, "out_h": 0, "cropped": False,
                }]},
                "result": (image, MIN_DIM, MIN_DIM),
            }

        in_w, in_h = frames[0].size
        plan = compute(in_w, in_h, state)
        cx, cy, cw, ch = plan["crop"]
        out_w, out_h = plan["size"]
        factor = (out_w / cw) if cw else 1.0
        resample = _pick_resample(state["resample"], factor)

        out = []
        for pil in frames:
            if pil.size != (in_w, in_h):
                p = compute(pil.size[0], pil.size[1], state)
                fx, fy, fw, fh = p["crop"]
                fw_out, fh_out = p["size"]
            else:
                fx, fy, fw, fh = cx, cy, cw, ch
                fw_out, fh_out = out_w, out_h

            if (fx, fy, fw, fh) != (0, 0, pil.size[0], pil.size[1]):
                pil = pil.crop((fx, fy, fx + fw, fy + fh))
            if pil.size != (fw_out, fh_out):
                pil = pil.resize((fw_out, fh_out), resample)

            out.append(torch.from_numpy(np.array(pil).astype(np.float32) / 255.0)[None,])

        out_image = torch.cat(out, dim=0) if len(out) > 1 else out[0]
        return {
            "ui": {"artthreads_longest_side": [{
                "in_w": in_w, "in_h": in_h, "out_w": out_w, "out_h": out_h,
                "cropped": bool(plan["cropped"]),
            }]},
            "result": (out_image, out_w, out_h),
        }


NODE_CLASS_MAPPINGS = {"ArtThreadsLongestSide": ArtThreadsLongestSide}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsLongestSide": "Longest Side ArtThreads"}
