class ArtThreadsRunTimer:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "ArtThreads/Utils"

    def noop(self):
        return ()


NODE_CLASS_MAPPINGS = {"ArtThreadsRunTimer": ArtThreadsRunTimer}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsRunTimer": "Run Timer ArtThreads"}
