import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyGalleries, findManyImages } = vi.hoisted(() => ({
  findManyGalleries: vi.fn(),
  findManyImages: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      galleries: { findMany: findManyGalleries },
      images: { findMany: findManyImages },
    },
  },
}));

import { getPublishedGalleriesByCategory } from "../galleries";

describe("getPublishedGalleriesByCategory", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
  });

  it("returns empty array when no galleries match", async () => {
    findManyGalleries.mockResolvedValue([]);
    const result = await getPublishedGalleriesByCategory("places");
    expect(result).toEqual([]);
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("attaches cover image when coverImageId is set", async () => {
    findManyGalleries.mockResolvedValue([
      { id: "g1", title: "G1", slug: "g1", coverImageId: "i1", category: "places", isPublished: 1, sortOrder: 0 },
      { id: "g2", title: "G2", slug: "g2", coverImageId: null, category: "places", isPublished: 1, sortOrder: 1 },
    ]);
    findManyImages.mockResolvedValue([
      { id: "i1", thumbnailUrl: "https://cdn/i1.webp", width: 800, height: 1000, altText: null },
    ]);
    const result = await getPublishedGalleriesByCategory("places");
    expect(result[0].coverImage?.id).toBe("i1");
    expect(result[1].coverImage).toBeNull();
  });
});

import { getHomepageGridImages } from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
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
    findManyImages.mockResolvedValue(fakeImages);

    const result = await getHomepageGridImages();
    expect(result).toHaveLength(12);
    expect(result.every((r) => r.gallerySlug === "places-trip")).toBe(true);
  });
});
