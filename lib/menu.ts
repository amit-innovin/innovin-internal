// Food menu — tea, snacks and meals. Admin-managed from backend later.
// price: null = coordinator settles the price; it won't count toward the admin total.
export const MENU = [
  { id: "tea", name: "Tea", price: 15, icon: "coffee", tone: "sky" },
  { id: "snacks", name: "Snacks", price: 40, icon: "cookie", tone: "blue" },
  { id: "healthy", name: "Healthy Option", price: 60, icon: "leaf", tone: "green" },
  { id: "lunch", name: "Lunch", price: null, icon: "utensils", tone: "amber" },
  { id: "dinner", name: "Dinner", price: null, icon: "soup", tone: "ink" },
] as const;
