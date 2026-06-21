// Kiki's meow wallet: the island currency she earns from quests and spends at
// the Crusty Crab and the goat farm. Pure logic, no React or storage here.

export const BURGER_PRICE_MEOWS = 100;
export const ORACLE_REWARD_MEOWS = 100;

// Kiki levels up as she banks meows over her whole stay. Levels are purely
// cosmetic progression (a title + a small walk-speed bonus), so they read off
// lifetime earnings rather than the spendable balance.
export interface KikiLevel {
  level: number;
  title: string;
  // Lifetime meows required to reach this level.
  threshold: number;
}

export const KIKI_LEVELS: KikiLevel[] = [
  { level: 1, title: "Beach Kitten", threshold: 0 },
  { level: 2, title: "Sandy Paws", threshold: 150 },
  { level: 3, title: "Dock Courier", threshold: 350 },
  { level: 4, title: "Tide Runner", threshold: 700 },
  { level: 5, title: "Island Legend", threshold: 1200 },
];

export function rewardForOracleResult(passed: boolean) {
  return passed ? ORACLE_REWARD_MEOWS : 0;
}

export function canAfford(meows: number, price: number) {
  return meows >= price;
}

// Back-compat helper kept for the burger flow and its existing test.
export function canBuyBurger(meows: number) {
  return canAfford(meows, BURGER_PRICE_MEOWS);
}

export function earnMeows(meows: number, amount: number) {
  return meows + Math.max(0, amount);
}

// Spend `price` meows if affordable, otherwise leave the balance untouched.
export function spendMeows(meows: number, price: number) {
  return canAfford(meows, price) ? meows - price : meows;
}

export function spendBurgerMeows(meows: number) {
  return spendMeows(meows, BURGER_PRICE_MEOWS);
}

// The highest level whose threshold the lifetime earnings have reached.
export function levelForEarnings(lifetimeMeows: number): KikiLevel {
  let current = KIKI_LEVELS[0];
  for (const level of KIKI_LEVELS) {
    if (lifetimeMeows >= level.threshold) {
      current = level;
    }
  }
  return current;
}

// The next level Kiki is working toward, or null once she is maxed out.
export function nextLevel(lifetimeMeows: number): KikiLevel | null {
  return (
    KIKI_LEVELS.find((level) => level.threshold > lifetimeMeows) ?? null
  );
}

// 0..1 progress from the current level threshold to the next one.
export function levelProgress(lifetimeMeows: number): number {
  const current = levelForEarnings(lifetimeMeows);
  const next = nextLevel(lifetimeMeows);
  if (!next) {
    return 1;
  }
  const span = next.threshold - current.threshold;
  if (span <= 0) {
    return 1;
  }
  return Math.min(1, (lifetimeMeows - current.threshold) / span);
}
