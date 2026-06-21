import { describe, expect, it } from "vitest";

import {
  BURGER_PRICE_MEOWS,
  canBuyBurger,
  rewardForOracleResult,
  spendBurgerMeows,
} from "@/features/kiki-burger-quest/lib/kiki-burger-quest";

describe("kiki burger quest rules", () => {
  it("rewards exactly 100 meows after a successful oracle task", () => {
    expect(rewardForOracleResult(true)).toBe(100);
  });

  it("rewards no meows after a failed oracle task", () => {
    expect(rewardForOracleResult(false)).toBe(0);
  });

  it("allows burger purchase only with enough meows", () => {
    expect(canBuyBurger(BURGER_PRICE_MEOWS)).toBe(true);
    expect(canBuyBurger(BURGER_PRICE_MEOWS - 1)).toBe(false);
  });

  it("spends 100 meows for the burger", () => {
    expect(spendBurgerMeows(100)).toBe(0);
    expect(spendBurgerMeows(140)).toBe(40);
  });
});
