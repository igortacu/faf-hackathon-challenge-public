import re

from config import settings

# Character used to mask a profane word, preserving its length. Single source of
# truth so store-derived metrics (admin.py) can detect a masked message.
MASK_CHAR = "*"

# Stop list sourced from PROFANITY_WORDS (config.py), comma-separated, falling back
# to the curated default when unset.
PROFANITY_WORDS = [w.strip().lower() for w in settings.profanity_words.split(",") if w.strip()]
_PROFANITY_SET = set(PROFANITY_WORDS)

# Leetspeak / letter-swap substitutions, mapping the disguised character to the
# plain letter it stands in for. This is what lets "a$$" and "sh1t" be recognised
# as swears while never altering the user's original text — we only normalise a
# *copy* of each token for the comparison.
_LEET_MAP = {
    "$": "s",
    "@": "a",
    "0": "o",
    "1": "i",
    "!": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b",
    "9": "g",
}

# A token is a maximal run of letters plus leetspeak symbols that contains at
# least one letter (the lookahead). We match whole tokens — then compare the
# normalised form to the stop list — rather than scanning for substrings, so a
# swear embedded in an innocent word ("ass" in "passport") never matches. Leet
# symbols are part of the token, so "a$$" and "sh1t" are each captured as one
# unit. A non-swear token is returned verbatim, so trailing punctuation that
# happens to be a leet symbol ("hello!") is harmless: "hello!" normalises to a
# non-swear and is emitted unchanged.
_LEET_CHARS = "".join(re.escape(c) for c in _LEET_MAP)
_TOKEN_RE = re.compile(rf"(?=[A-Za-z{_LEET_CHARS}]*[A-Za-z])[A-Za-z{_LEET_CHARS}]+")


def _normalise(token: str) -> str:
    """Fold a token to its comparison form: lowercase, with leetspeak undone."""
    return "".join(_LEET_MAP.get(ch, ch) for ch in token.lower())


# A few leet symbols double as sentence punctuation when they sit at a word's
# edge ("Shit!"). We strip *only* those from the ends before the swear check, so
# a punctuated swear is still caught while an innocent word that merely ends in
# one ("hello!") normalises to a non-swear and is left alone. Letter-substitute
# symbols like "$" are NOT stripped — they stand in for a letter inside the word
# ("a$$" -> "ass") and are folded by _normalise. Interior symbols are always kept.
_EDGE_PUNCTUATION = "!"


def _is_profane(token: str) -> bool:
    stripped = token.strip(_EDGE_PUNCTUATION)
    return bool(stripped) and _normalise(stripped) in _PROFANITY_SET


def mask_profanity(text: str) -> str:
    """Mask profane words in user-supplied text, preserving length with '*'.

    Only whole words are masked — including obvious letter-swap / leetspeak
    variants such as "a$$" — so swear words appearing as substrings of innocent
    words ("passport", "assertive", "hello") are left completely untouched.
    """
    if not text or not _PROFANITY_SET:
        return text

    def _replace(match: "re.Match[str]") -> str:
        token = match.group(0)
        return MASK_CHAR * len(token) if _is_profane(token) else token

    return _TOKEN_RE.sub(_replace, text)


def contains_mask(text) -> bool:
    """True if text carries a profanity mask produced by mask_profanity."""
    return bool(text) and MASK_CHAR in text
