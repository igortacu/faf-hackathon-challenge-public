"""Tests for the profanity filter.

Run from services/parrot with: python -m unittest test_profanity
(No extra dependencies — uses the stdlib unittest runner.)
"""

import os
import unittest

# Pin the stop list so the tests don't depend on the deployed PROFANITY_WORDS.
os.environ["PROFANITY_WORDS"] = "ass,crap,damn,hell,piss,shit,bastard"

from profanity import contains_mask, mask_profanity  # noqa: E402


class LeavesInnocentTextUntouched(unittest.TestCase):
    """Swear words appearing as substrings of innocent words must not match."""

    CASES = [
        "assertive",
        "passport",
        "hello",
        "Hello there!",
        "class",
        "glass",
        "massive",
        "pass",
        "classic",
        "grass",
        "I want to be more assertive",
        "Where is my passport for the hotel?",
        "what a nice day",
        "hi!",
    ]

    def test_unchanged(self):
        for text in self.CASES:
            with self.subTest(text=text):
                self.assertEqual(mask_profanity(text), text)


class MasksRealSwears(unittest.TestCase):
    """Real swears are masked, including obvious letter-swap / leetspeak variants."""

    # (input, expected) — expected length always matches the masked token.
    CASES = [
        ("damn", "****"),
        ("crap", "****"),
        ("ASS", "***"),
        ("a$$", "***"),          # letter-swap: $ -> s
        ("sh1t", "****"),        # leetspeak: 1 -> i
        ("sh!t", "****"),        # leetspeak: ! -> i (interior)
        ("cr@p", "****"),        # @ -> a
        ("h3ll", "****"),        # 3 -> e
        ("p1ss", "****"),        # 1 -> i
        ("b@stard", "*******"),
    ]

    def test_masked(self):
        for text, expected in self.CASES:
            with self.subTest(text=text):
                self.assertEqual(mask_profanity(text), expected)

    def test_in_context(self):
        self.assertEqual(mask_profanity("that is total crap."), "that is total ****.")
        self.assertEqual(mask_profanity("Damn it"), "**** it")
        # Punctuated swear: trailing "!" is treated as punctuation, not a letter.
        self.assertEqual(mask_profanity("Shit!"), "*****")


class Contract(unittest.TestCase):
    """Behaviour admin.py relies on: contains_mask + length preservation."""

    def test_contains_mask(self):
        self.assertTrue(contains_mask(mask_profanity("damn")))
        self.assertFalse(contains_mask(mask_profanity("hello")))

    def test_length_preserved(self):
        self.assertEqual(len(mask_profanity("bastard")), len("bastard"))

    def test_empty_and_none(self):
        self.assertEqual(mask_profanity(""), "")
        self.assertEqual(mask_profanity(None), None)


if __name__ == "__main__":
    unittest.main()
