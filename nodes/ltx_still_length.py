STILL_LENGTH_OPTIONS = (9, 17, 25)
DEFAULT_STILL_LENGTH = 9


class ArtThreadsLTXStillLength:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frames": (list(STILL_LENGTH_OPTIONS), {"default": DEFAULT_STILL_LENGTH}),
            },
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("frames",)
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Image"

    def run(self, frames=DEFAULT_STILL_LENGTH):
        value = int(frames)
        if value not in STILL_LENGTH_OPTIONS:
            raise ValueError(
                f"[ArtThreads] LTX still length must be one of {STILL_LENGTH_OPTIONS}, "
                f"got {value}."
            )
        return (value,)


NODE_CLASS_MAPPINGS = {
    "ArtThreadsLTXStillLength": ArtThreadsLTXStillLength,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ArtThreadsLTXStillLength": "LTX Still Length ArtThreads",
}
