// Kiki's survival needs. She has a hunger bar and a thirst bar that both start
// low and drain over time. Eating at the Crusty Crab refills hunger; drinking
// at the goat farm refills thirst. Both cost meows, so when she is broke she
// detours to the Octopus to earn first. Pure logic, no React or storage.

export type NeedKind = "hunger" | "thirst";

// Bars run 0..100. 100 is full and happy, 0 is desperate.
export const NEED_MAX = 100;
export const NEED_START = 30;

// How much one bar drains per real second of idling. A full bar lasts a few
// minutes, so Kiki gets peckish at a relaxed pace rather than constantly.
export const NEED_DRAIN_PER_SECOND = 0.4;

// A meal/drink costs this many meows and refills this much of the bar.
export const NEED_PRICE_MEOWS = 40;
export const NEED_REFILL = 60;

// What Kiki buys for each need, and where she buys it.
export const NEED_CONFIG: Record<
  NeedKind,
  { label: string; verb: string; shop: "crab" | "goat"; icon: string }
> = {
  hunger: { label: "Hunger", verb: "Eat", shop: "crab", icon: "🍔" },
  thirst: { label: "Thirst", verb: "Drink", shop: "goat", icon: "🥛" },
};

export function clampNeed(value: number): number {
  return Math.max(0, Math.min(NEED_MAX, value));
}

// Drain a bar for `seconds` of elapsed time.
export function drainNeed(value: number, seconds: number): number {
  return clampNeed(value - NEED_DRAIN_PER_SECOND * Math.max(0, seconds));
}

export function refillNeed(value: number, amount = NEED_REFILL): number {
  return clampNeed(value + amount);
}

// Below this Kiki looks visibly distressed and the bar turns red.
export const NEED_CRITICAL = 25;

export function isCritical(value: number): boolean {
  return value <= NEED_CRITICAL;
}

// The need Kiki should deal with first, or null if both are comfortably full.
export function mostUrgentNeed(
  hunger: number,
  thirst: number
): NeedKind | null {
  if (hunger >= NEED_MAX && thirst >= NEED_MAX) {
    return null;
  }
  return hunger <= thirst ? "hunger" : "thirst";
}

export function canPayForNeed(meows: number): boolean {
  return meows >= NEED_PRICE_MEOWS;
}
