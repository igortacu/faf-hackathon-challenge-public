import { describe, expect, it } from "vitest";

import {
  evaluateQuiz,
  evaluateSequence,
  RED_TRIAL_COLORS,
  randomSequence,
} from "@/features/octopus-oracle/lib/octopus-oracle";

describe("octopus oracle rules", () => {
  it("passes the blue pill trial with at least two correct answers", () => {
    expect(evaluateQuiz([true, true, false])).toEqual({
      passed: true,
      correct: 2,
    });
  });

  it("fails the blue pill trial with fewer than two correct answers", () => {
    expect(evaluateQuiz([true, false, false])).toEqual({
      passed: false,
      correct: 1,
    });
  });

  it("passes the red pill trial only when the color sequence matches", () => {
    expect(evaluateSequence(["blue", "red", "violet"], ["blue", "red", "violet"]))
      .toBe(true);
    expect(evaluateSequence(["blue", "red", "violet"], ["blue", "violet", "red"]))
      .toBe(false);
  });

  it("shuffles all four pearls into a fresh order without dropping any", () => {
    const sequence = randomSequence();
    expect(sequence).toHaveLength(RED_TRIAL_COLORS.length);
    expect([...sequence].sort()).toEqual([...RED_TRIAL_COLORS].sort());
  });

  it("is a true permutation driven by the injected random source", () => {
    // A reversing "random" yields the exact Fisher–Yates reversal of the input.
    const reversed = randomSequence(() => 0);
    expect(reversed).toEqual(["red", "violet", "amber", "blue"]);
  });
});
