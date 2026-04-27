import { describe, it, expect } from "vitest";
import { parseSocialLinks, SETTINGS_ID } from "../settings";

describe("SETTINGS_ID", () => {
  it("is 'default'", () => {
    expect(SETTINGS_ID).toBe("default");
  });
});

describe("parseSocialLinks", () => {
  it("parses valid JSON array", () => {
    const result = parseSocialLinks('[{"platform":"ig","url":"https://ig.com"}]');
    expect(result).toEqual([{ platform: "ig", url: "https://ig.com" }]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseSocialLinks("[]")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSocialLinks("not-json")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSocialLinks("")).toEqual([]);
  });

  it("returns empty array for undefined/null input", () => {
    expect(parseSocialLinks(undefined)).toEqual([]);
    expect(parseSocialLinks(null)).toEqual([]);
  });

  it("returns [] for non-array JSON like a number", () => {
    expect(parseSocialLinks("42")).toEqual([]);
  });

  it("returns [] for a JSON string scalar", () => {
    expect(parseSocialLinks('"hello"')).toEqual([]);
  });

  it("returns [] for null literal", () => {
    expect(parseSocialLinks("null")).toEqual([]);
  });

  it("filters out items missing platform or url", () => {
    expect(
      parseSocialLinks(
        JSON.stringify([
          { platform: "instagram", url: "https://x" },
          { platform: "twitter" }, // missing url
          { url: "https://y" }, // missing platform
          "string", // not an object
        ]),
      ),
    ).toEqual([{ platform: "instagram", url: "https://x" }]);
  });
});
