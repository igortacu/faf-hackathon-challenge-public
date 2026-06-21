export const BURGER_PRICE_MEOWS = 100;
export const ORACLE_REWARD_MEOWS = 100;

export function rewardForOracleResult(passed: boolean) {
  return passed ? ORACLE_REWARD_MEOWS : 0;
}

export function canBuyBurger(meows: number) {
  return meows >= BURGER_PRICE_MEOWS;
}

export function spendBurgerMeows(meows: number) {
  return canBuyBurger(meows) ? meows - BURGER_PRICE_MEOWS : meows;
}
