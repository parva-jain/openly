"""Openly — a build-in-public content assistant.

Stage 0: the `draft` call. Hand it a content type + a one-line intent
(+ optional context) and get back a usable first draft for a platform.
"""

from openly.content_types import ContentType
from openly.draft import DraftResult, draft, fuse

__all__ = ["ContentType", "draft", "fuse", "DraftResult"]
