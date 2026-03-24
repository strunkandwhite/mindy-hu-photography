import { describe, it, expect } from "vitest";
import { slugify } from "../slugify";

describe("slugify", () => {
  it("converts to kebab-case", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Café & Résumé!")).toBe("caf-r-sum");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("one---two   three")).toBe("one-two-three");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("handles mixed alphanumeric", () => {
    expect(slugify("Photo Set 2024")).toBe("photo-set-2024");
  });
});
