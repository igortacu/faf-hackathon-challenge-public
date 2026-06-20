export const goatFarmKeys = {
  all: ["goat-farm"] as const,
  stock: () => [...goatFarmKeys.all, "stock"] as const,
};
