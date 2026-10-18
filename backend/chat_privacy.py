"""Publication policy for chat excerpts sent to the shared activity feed."""

from collections.abc import Mapping


def should_publish_chat(context: object) -> bool:
    """Allow feed excerpts only when the caller explicitly chooses public visibility.

    Missing or malformed privacy metadata stays private. An explicit private flag
    overrides public visibility, and only an actual boolean ``False`` is accepted
    when ``isPrivate`` is present; strings and integers are not consent.
    """
    if not isinstance(context, Mapping):
        return False
    if context.get("visibility") != "public":
        return False
    if "isPrivate" in context and context["isPrivate"] is not False:
        return False
    return True
