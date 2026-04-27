import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyGalleries, selectImages } = vi.hoisted(() => ({
  findManyGalleries: vi.fn(),
  selectImages: vi.fn(),
}));

vi.mock("@/db/client", () => {
  const limit = vi.fn(() => selectImages());
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    db: {
      query: {
        galleries: { findMany: findManyGalleries },
      },
      select,
    },
  };
});

import { getHomepageGridImages } from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    selectImages.mockReset();
  });

  it("returns empty array when no published galleries exist", async () => {
    findManyGalleries.mockResolvedValue([]);
    const result = await getHomepageGridImages();
    expect(result).toEqual([]);
  });

  it("caps results at 12 and attaches gallerySlug for each image", async () => {
    findManyGalleries.mockResolvedValue([
      { id: "g1", slug: "places-trip", isPublished: 1 },
    ]);
    const fakeImages = Array.from({ length: 20 }, (_, i) => ({
      id: `i${i}`,
      galleryId: "g1",
      thumbnailUrl: `https://cdn/i${i}.webp`,
      width: 800,
      height: 600,
      altText: null,
      filename: `i${i}.jpg`,
    }));
    selectImages.mockResolvedValue(fakeImages);

    const result = await getHomepageGridImages();
    expect(result).toHaveLength(12);
    expect(result.every((r) => r.gallerySlug === "places-trip")).toBe(true);
  });
});
