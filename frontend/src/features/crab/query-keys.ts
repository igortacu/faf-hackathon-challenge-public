export const crabKeys = {
  all: ["crab"] as const,
  menu: () => [...crabKeys.all, "menu"] as const,
  orders: (guestId: string) => [...crabKeys.all, "orders", guestId] as const,
};
