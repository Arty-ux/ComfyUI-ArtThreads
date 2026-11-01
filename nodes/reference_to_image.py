"""ArtThreads wrappers: Multi Reference → MiniMax H3 still."""

from __future__ import annotations

from lib.multi_reference import REFERENCE_IMAGES_TYPE, bundle_to_stock_ref_images

# Stock MiniMax H3 snaps length to the 17k+5 grid; 5 is the minimum still request.
STILL_LENGTH = 5
# Next valid packet after 5 — more temporal context for sharper stills (slower).
MAX_QUALITY_LENGTH = 22
# Prefer the second decoded frame; first is often softer on H3 stills.
RECOMMENDED_STILL_FRAME = 1


def _as_tuple(result):
    """Unwrap io.NodeOutput / sequence into a plain (positive, latent) tuple."""
    if result is None:
        raise RuntimeError("[ArtThreads] MiniMaxH3ReferenceToVideo returned None.")
    if isinstance(result, tuple):
        return result
    args = getattr(result, "args", None)
    if args is not None:
        return tuple(args)
    try:
        return tuple(result)
    except TypeError as exc:
        raise RuntimeError(
            "[ArtThreads] Unexpected MiniMaxH3ReferenceToVideo return type: "
            f"{type(result).__name__}"
        ) from exc


def _run_reference_to_still(
    clip,
    vae,
    artthreads_ref_images,
    prompt,
    width,
    height,
    *,
    length,
    ref_image_size,
):
    from comfy_extras.nodes_minimax_h3 import MiniMaxH3ReferenceToVideo

    ref_images = bundle_to_stock_ref_images(artthreads_ref_images)
    result = MiniMaxH3ReferenceToVideo.execute(
        clip=clip,
        vae=vae,
        audio_vae=None,
        prompt=prompt or "",
        width=int(width),
        height=int(height),
        length=int(length),
        ref_image_size=ref_image_size,
        ref_images=ref_images,
        ref_videos=None,
        ref_video_audios=None,
        ref_audios=None,
    )
    return _as_tuple(result)


class ArtThreadsMiniMaxH3ReferenceToImage:
    """REF2VA conditioning for a fast still: refs + prompt → positive + latent (length=5)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "vae": ("VAE",),
                "artthreads_ref_images": (REFERENCE_IMAGES_TYPE,),
                "prompt": ("STRING", {"multiline": True, "default": ""}),
                "width": ("INT", {"default": 896, "min": 32, "max": 8192, "step": 32}),
                "height": ("INT", {"default": 512, "min": 32, "max": 8192, "step": 32}),
                "ref_image_size": (["match", "max"], {"default": "match"}),
            },
        }

    RETURN_TYPES = ("CONDITIONING", "LATENT")
    RETURN_NAMES = ("positive", "LATENT")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Image"

    def run(
        self,
        clip,
        vae,
        artthreads_ref_images,
        prompt,
        width,
        height,
        ref_image_size="match",
    ):
        return _run_reference_to_still(
            clip,
            vae,
            artthreads_ref_images,
            prompt,
            width,
            height,
            length=STILL_LENGTH,
            ref_image_size=ref_image_size,
        )


class ArtThreadsMiniMaxH3ReferenceToImageMaxQuality:
    """Max-quality REF2VA still: length=22, ref_image_size=max, ~1MP defaults.

    Also returns `still_frame_index` for ImageFromBatch (default: second frame).
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "vae": ("VAE",),
                "artthreads_ref_images": (REFERENCE_IMAGES_TYPE,),
                "prompt": ("STRING", {"multiline": True, "default": ""}),
                "width": ("INT", {"default": 1344, "min": 32, "max": 8192, "step": 32}),
                "height": ("INT", {"default": 768, "min": 32, "max": 8192, "step": 32}),
                "still_frame_index": (
                    "INT",
                    {
                        "default": RECOMMENDED_STILL_FRAME,
                        "min": 0,
                        "max": MAX_QUALITY_LENGTH - 1,
                        "step": 1,
                        "tooltip": "Which decoded frame to keep. Second frame (1) is usually sharpest.",
                    },
                ),
            },
        }

    RETURN_TYPES = ("CONDITIONING", "LATENT", "INT")
    RETURN_NAMES = ("positive", "LATENT", "still_frame_index")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Image"

    def run(
        self,
        clip,
        vae,
        artthreads_ref_images,
        prompt,
        width,
        height,
        still_frame_index=RECOMMENDED_STILL_FRAME,
    ):
        positive, latent = _run_reference_to_still(
            clip,
            vae,
            artthreads_ref_images,
            prompt,
            width,
            height,
            length=MAX_QUALITY_LENGTH,
            ref_image_size="max",
        )
        idx = max(0, min(int(still_frame_index), MAX_QUALITY_LENGTH - 1))
        return (positive, latent, idx)


NODE_CLASS_MAPPINGS = {
    "ArtThreadsMiniMaxH3ReferenceToImage": ArtThreadsMiniMaxH3ReferenceToImage,
    "ArtThreadsMiniMaxH3ReferenceToImageMaxQuality": ArtThreadsMiniMaxH3ReferenceToImageMaxQuality,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ArtThreadsMiniMaxH3ReferenceToImage": "Reference to Image ArtThreads",
    "ArtThreadsMiniMaxH3ReferenceToImageMaxQuality": "Reference to Image Max Quality ArtThreads",
}
