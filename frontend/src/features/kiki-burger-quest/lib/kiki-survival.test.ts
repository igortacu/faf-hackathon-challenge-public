import { describe, expect, it } from "vitest";

import {
  canPayForNeed,
  clampNeed,
  drainNeed,
  isCritical,
  mostUrgentNeed,
  NEED_DRAIN_PER_SECOND,
  NEED_MAX,
  NEED_PRICE_MEOWS,
  refillNeed,
} from "@/features/kiki-burger-quest/lib/kiki-survival";

describe("kiki survival needs", () => {
  it("clamps bars to the 0..100 range", () => {
    expect(clampNeed(-10)).toBe(0);
    expect(clampNeed(140)).toBe(NEED_MAX);
    expect(clampNeed(50)).toBe(50);
  });

  it("drains a bar over elapsed seconds without going below zero", () => {
    expect(drainNeed(50, 10)).toBeCloseTo(50 - NEED_DRAIN_PER_SECOND * 10);
    expect(drainNeed(5, 100)).toBe(0);
  });

  it("refills a bar without overflowing", () => {
    expect(refillNeed(20, 30)).toBe(50);
    expect(refillNeed(90, 60)).toBe(NEED_MAX);
  });

  it("flags a critically low bar", () => {
    expect(isCritical(10)).toBe(true);
    expect(isCritical(80)).toBe(false);
  });

  it("picks the lower bar as most urgent, and null when both are full", () => {
    expect(mostUrgentNeed(20, 80)).toBe("hunger");
    expect(mostUrgentNeed(80, 20)).toBe("thirst");
    expect(mostUrgentNeed(NEED_MAX, NEED_MAX)).toBeNull();
  });

  it("knows when Kiki can afford a meal or drink", () => {
    expect(canPayForNeed(NEED_PRICE_MEOWS)).toBe(true);
    expect(canPayForNeed(NEED_PRICE_MEOWS - 1)).toBe(false);
  });
});
