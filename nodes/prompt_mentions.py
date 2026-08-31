from __future__ import annotations

from lib.prompt_mentions import canonicalize_media_tags


class ArtThreadsPromptMentions:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prompt": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "run"
    CATEGORY = "ArtThreads/Text"

    def run(self, prompt=""):
        return (canonicalize_media_tags(prompt),)


NODE_CLASS_MAPPINGS = {"ArtThreadsPromptMentions": ArtThreadsPromptMentions}
NODE_DISPLAY_NAME_MAPPINGS = {"ArtThreadsPromptMentions": "Prompt Mentions ArtThreads"}
