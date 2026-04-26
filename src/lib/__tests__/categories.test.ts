import { describe, it, expect } from "vitest";
import { CATEGORIES, isCategory, type Category } from "../categories";

describe("categories", () => {
  it("exposes the canonical list", () => {
    expect(CATEGORIES).toEqual(["people", "places", "prints"]);
  });

  it("isCategory accepts valid values", () => {
    expect(isCategory("people")).toBe(true);
    expect(isCategory("places")).toBe(true);
    expect(isCategory("prints")).toBe(true);
  });

  it("isCategory rejects invalid values", () => {
    expect(isCategory("portraits")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(null)).toBe(false);
    expect(isCategory(undefined)).toBe(false);
    expect(isCategory(42)).toBe(false);
  });

  it("Category type narrows to the literal union", () => {
    const c: Category = "people";
    expect(CATEGORIES).toContain(c);
  });
});
