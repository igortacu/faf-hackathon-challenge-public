import { describe, expect, it } from "vitest";

import { evaluateQuiz, evaluateSequence } from "@/features/octopus-oracle/lib/octopus-oracle";

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
});
