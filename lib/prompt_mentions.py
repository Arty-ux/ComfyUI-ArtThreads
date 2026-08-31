from __future__ import annotations

import re

MEDIA_TAG_RE = re.compile(
    r"<\s*(Image|Picture|Video|Audio)\s*(\d+)\s*>|"
    r"(?<![\w<])(Image|Picture|Video|Audio)\s*#?\s*(\d+)\b(?!\s*>)",
    re.IGNORECASE,
)

AT_MENTION_RE = re.compile(
    r"@\s*(Image|Picture|Video|Audio)\s*(\d+)\b",
    re.IGNORECASE,
)


def _official_type(media_type: str) -> str:
    kind = (media_type or "").lower()
    if kind in {"image", "picture"}:
        return "Picture"
    return kind.title()


def canonicalize_media_tags(prompt: str) -> str:
    """Normalize @Image/@Picture and loose Image 1 forms to <Picture N> etc."""
    text = prompt or ""

    def at_repl(match: re.Match) -> str:
        return f"<{_official_type(match.group(1))} {int(match.group(2))}>"

    text = AT_MENTION_RE.sub(at_repl, text)

    def angle_repl(match: re.Match) -> str:
        media_type = match.group(1) or match.group(3)
        ordinal = int(match.group(2) or match.group(4))
        return f"<{_official_type(media_type)} {ordinal}>"

    return MEDIA_TAG_RE.sub(angle_repl, text)
