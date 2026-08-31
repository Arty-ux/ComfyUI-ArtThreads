"""Canonicalize + node run tests for Prompt Mentions ArtThreads.

Manual checklist (ComfyUI UI):
1. Load ArtThreads_MultiReference_AudioSync_v1.1.json
2. Confirm node 7 is Prompt Mentions with tray thumbnails for Multiref + audios
3. Type @ — dropdown lists Image/Audio refs with previews
4. Insert a mention; green chip appears; stored text is <Picture N>/<Audio N>
5. Queue prompt — Fixed 3 Audio Refs still receives the STRING prompt
"""

from lib.prompt_mentions import canonicalize_media_tags
from nodes.prompt_mentions import ArtThreadsPromptMentions


def test_canonicalize_angle_tags():
    assert canonicalize_media_tags("use <picture 1> and <IMAGE 2>") == "use <Picture 1> and <Picture 2>"
    assert canonicalize_media_tags("<Audio 3> + <video 1>") == "<Audio 3> + <Video 1>"


def test_canonicalize_at_mentions():
    assert canonicalize_media_tags("style @Image 1 onto @Picture 2") == "style <Picture 1> onto <Picture 2>"
    assert canonicalize_media_tags("@Audio 1 and @audio 2") == "<Audio 1> and <Audio 2>"


def test_canonicalize_loose_forms():
    assert canonicalize_media_tags("see Picture 1 then Audio #2") == "see <Picture 1> then <Audio 2>"


def test_canonicalize_passthrough():
    text = "plain text with no tags"
    assert canonicalize_media_tags(text) == text
    assert canonicalize_media_tags("") == ""
    assert canonicalize_media_tags(None) == ""


def test_node_run_canonicalizes():
    out = ArtThreadsPromptMentions().run(prompt="hero from @Image 1 with <audio 2>")
    assert out == ("hero from <Picture 1> with <Audio 2>",)
