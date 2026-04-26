export const CATEGORIES = ["people", "places", "prints"] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABELS: Record<Category, string> = {
  people: "People",
  places: "Places",
  prints: "Prints",
};
