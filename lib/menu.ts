// Snack & tea menu — admin-managed from backend later.
export const MENU = [
  { id: "tea", name: "Tea", price: 15 },
  { id: "snacks", name: "Snacks", price: 40 },
  { id: "healthy", name: "Healthy Option", price: 60 },
] as const;

export const ORDER_CUTOFF_HOUR = 11; // orders close at 11:00 AM
