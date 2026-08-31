from lib.duration_math import compute


class ArtThreadsDuration:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {"DurationState": ("STRING", {"default": "{}"})},
        }

    RETURN_TYPES = ("INT", "FLOAT")
    RETURN_NAMES = ("frames", "seconds")
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Video"

    def run(self, DurationState="{}"):
        frames, seconds = compute(DurationState)
        return (frames, seconds)


NODE_CLASS_MAPPINGS = {"ArtThreadsDuration": ArtThreadsDuration}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsDuration": "Duration ArtThreads"}
