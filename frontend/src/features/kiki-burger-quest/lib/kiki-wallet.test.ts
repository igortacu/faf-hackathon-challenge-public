import { describe, expect, it } from "vitest";

import {
  BURGER_PRICE_MEOWS,
  canAfford,
  canBuyBurger,
  earnMeows,
  levelForEarnings,
  levelProgress,
  nextLevel,
  rewardForOracleResult,
  spendBurgerMeows,
  spendMeows,
} from "@/features/kiki-burger-quest/lib/kiki-wallet";

describe("kiki wallet", () => {
  it("rewards 100 meows for a passed oracle trial and 0 for a failed one", () => {
    expect(rewardForOracleResult(true)).toBe(100);
    expect(rewardForOracleResult(false)).toBe(0);
  });

  it("checks affordability against an arbitrary price", () => {
    expect(canAfford(100, 100)).toBe(true);
    expect(canAfford(99, 100)).toBe(false);
    expect(canBuyBurger(BURGER_PRICE_MEOWS)).toBe(true);
    expect(canBuyBurger(BURGER_PRICE_MEOWS - 1)).toBe(false);
  });

  it("earns meows without going below the prior balance", () => {
    expect(earnMeows(20, 60)).toBe(80);
    expect(earnMeows(20, -5)).toBe(20);
  });

  it("spends meows only when affordable", () => {
    expect(spendMeows(140, 100)).toBe(40);
    expect(spendMeows(40, 100)).toBe(40);
    expect(spendBurgerMeows(100)).toBe(0);
  });
});

describe("kiki leveling", () => {
  it("derives the level from lifetime earnings", () => {
    expect(levelForEarnings(0).level).toBe(1);
    expect(levelForEarnings(149).level).toBe(1);
    expect(levelForEarnings(150).level).toBe(2);
    expect(levelForEarnings(5000).level).toBe(5);
  });

  it("points at the next level until maxed out", () => {
    expect(nextLevel(0)?.threshold).toBe(150);
    expect(nextLevel(5000)).toBeNull();
  });

  it("reports progress toward the next level", () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(75)).toBeCloseTo(0.5);
    expect(levelProgress(5000)).toBe(1);
  });
});
