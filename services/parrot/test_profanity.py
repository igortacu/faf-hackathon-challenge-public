"""Tests for the profanity filter.

Run from services/parrot with: python -m unittest test_profanity
(No extra dependencies — uses the stdlib unittest runner.)
"""

import os
import unittest

# Pin the stop list so the tests don't depend on the deployed PROFANITY_WORDS.
os.environ["PROFANITY_WORDS"] = "ass,crap,damn,hell,piss,shit,bastard"

from profanity import mask_profanity  # noqa: E402


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
                result, was_masked = mask_profanity(text)
                self.assertEqual(result, text)
                self.assertFalse(was_masked)


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
                result, was_masked = mask_profanity(text)
                self.assertEqual(result, expected)
                self.assertTrue(was_masked)

    def test_in_context(self):
        self.assertEqual(mask_profanity("that is total crap."), ("that is total ****.", True))
        self.assertEqual(mask_profanity("Damn it"), ("**** it", True))
        self.assertEqual(mask_profanity("Shit!"), ("*****", True))


class Contract(unittest.TestCase):
    """Behaviour admin.py relies on: was_masked flag + length preservation."""

    def test_was_masked_flag(self):
        _, was_masked = mask_profanity("damn")
        self.assertTrue(was_masked)
        _, was_masked = mask_profanity("hello")
        self.assertFalse(was_masked)

    def test_asterisk_not_false_positive(self):
        result, was_masked = mask_profanity("2 * 3")
        self.assertEqual(result, "2 * 3")
        self.assertFalse(was_masked)

    def test_length_preserved(self):
        result, _ = mask_profanity("bastard")
        self.assertEqual(len(result), len("bastard"))

    def test_empty_and_none(self):
        self.assertEqual(mask_profanity(""), ("", False))
        self.assertEqual(mask_profanity(None), (None, False))


if __name__ == "__main__":
    unittest.main()
