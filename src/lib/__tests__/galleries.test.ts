import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyGalleries, findManyImages, selectImages } = vi.hoisted(() => ({
  findManyGalleries: vi.fn(),
  findManyImages: vi.fn(),
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
        images: { findMany: findManyImages },
      },
      select,
    },
  };
});

import {
  getHomepageGridImages,
  getPublishedGalleriesWithCovers,
} from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
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

  it("maps each image's gallerySlug from its galleryId, not from the first gallery", async () => {
    findManyGalleries.mockResolvedValue([
      { id: "g1", slug: "a", isPublished: 1 },
      { id: "g2", slug: "b", isPublished: 1 },
      { id: "g3", slug: "c", isPublished: 1 },
    ]);
    const fakeImages = [
      { id: "i1", galleryId: "g1", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i2", galleryId: "g1", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i3", galleryId: "g2", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i4", galleryId: "g2", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i5", galleryId: "g2", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i6", galleryId: "g3", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i7", galleryId: "g3", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i8", galleryId: "g3", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
      { id: "i9", galleryId: "g3", thumbnailUrl: "u", width: 1, height: 1, altText: null, filename: "f" },
    ];
    selectImages.mockResolvedValue(fakeImages);

    const images = await getHomepageGridImages();
    const slugs = new Set(images.map((i) => i.gallerySlug));
    expect(slugs.size).toBeGreaterThan(1);
    for (const img of images) {
      const expectedSlug =
        img.id === "i1" || img.id === "i2"
          ? "a"
          : img.id === "i3" || img.id === "i4" || img.id === "i5"
            ? "b"
            : "c";
      expect(img.gallerySlug).toBe(expectedSlug);
    }
  });
});

describe("getPublishedGalleriesWithCovers", () => {
  beforeEach(() => {
    findManyGalleries.mockReset();
    findManyImages.mockReset();
    selectImages.mockReset();
  });

  it("returns [] when no published galleries exist", async () => {
    findManyGalleries.mockResolvedValue([]);
    findManyImages.mockResolvedValue([]);
    expect(await getPublishedGalleriesWithCovers()).toEqual([]);
  });

  it("returns coverImage: null for galleries with no coverImageId", async () => {
    findManyGalleries.mockResolvedValue([
      {
        id: "g1",
        slug: "a",
        title: "A",
        description: null,
        coverImageId: null,
        sortOrder: 0,
        isPublished: 1,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);
    findManyImages.mockResolvedValue([]);
    const result = await getPublishedGalleriesWithCovers();
    expect(result).toHaveLength(1);
    expect(result[0].coverImage).toBeNull();
  });

  it("attaches the matching cover image when present", async () => {
    findManyGalleries.mockResolvedValue([
      {
        id: "g1",
        slug: "a",
        title: "A",
        description: null,
        coverImageId: "img-1",
        sortOrder: 0,
        isPublished: 1,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);
    findManyImages.mockResolvedValue([
      {
        id: "img-1",
        galleryId: "g1",
        thumbnailUrl: "t",
        cdnUrl: "c",
        width: 1,
        height: 1,
        altText: null,
        filename: "f",
        s3Key: "k",
        sortOrder: 0,
        createdAt: "2026-01-01",
      },
    ]);
    const result = await getPublishedGalleriesWithCovers();
    expect(result[0].coverImage?.id).toBe("img-1");
  });
});
