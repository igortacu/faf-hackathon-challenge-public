// The burger flow's rules now live in the shared meow wallet. This module is
// kept as a thin re-export so older imports (and tests) stay valid.
export {
  BURGER_PRICE_MEOWS,
  ORACLE_REWARD_MEOWS,
  canBuyBurger,
  rewardForOracleResult,
  spendBurgerMeows,
} from "@/features/kiki-burger-quest/lib/kiki-wallet";
