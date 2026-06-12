import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyGalleries, findFirstGallery, findManyImages, selectImages, limitSpy } = vi.hoisted(() => ({
  findManyGalleries: vi.fn(),
  findFirstGallery: vi.fn(),
  findManyImages: vi.fn(),
  selectImages: vi.fn(),
  limitSpy: vi.fn(),
}));

vi.mock("@/db/client", () => {
  const limit = limitSpy.mockImplementation(() => selectImages());
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const innerJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ innerJoin, where }));
  const select = vi.fn(() => ({ from }));
  return {
    db: {
      query: {
        galleries: { findMany: findManyGalleries, findFirst: findFirstGallery },
        images: { findMany: findManyImages },
      },
      select,
    },
  };
});

import {
  getHomepageGridImages,
  getPublishedGalleriesWithCovers,
  getPublishedGalleryBySlugWithImages,
} from "../galleries";

describe("getHomepageGridImages", () => {
  beforeEach(() => {
    selectImages.mockReset();
    limitSpy.mockClear();
  });

  it("returns [] when the join finds no published-gallery images", async () => {
    selectImages.mockResolvedValue([]);
    expect(await getHomepageGridImages()).toEqual([]);
  });

  it("returns the joined rows and caps the query at 12", async () => {
    const rows = [
      { id: "i1", thumbnailUrl: "t1", width: 800, height: 600, altText: null, gallerySlug: "trip", galleryTitle: "Trip" },
      { id: "i2", thumbnailUrl: "t2", width: 600, height: 800, altText: "alt", gallerySlug: "studio", galleryTitle: "Studio" },
    ];
    selectImages.mockResolvedValue(rows);

    const result = await getHomepageGridImages();
    expect(result).toEqual(rows);
    expect(limitSpy).toHaveBeenCalledWith(12);
  });
});

describe("getPublishedGalleryBySlugWithImages", () => {
  beforeEach(() => {
    findFirstGallery.mockReset();
    findManyImages.mockReset();
  });

  it("returns null for an unknown slug", async () => {
    findFirstGallery.mockResolvedValue(undefined);
    expect(await getPublishedGalleryBySlugWithImages("nope")).toBeNull();
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("returns null for an unpublished gallery (draft slugs are not public)", async () => {
    findFirstGallery.mockResolvedValue({ id: "g1", slug: "draft", isPublished: 0 });
    expect(await getPublishedGalleryBySlugWithImages("draft")).toBeNull();
    expect(findManyImages).not.toHaveBeenCalled();
  });

  it("returns the gallery with images projected through toPublicImage (no s3Key)", async () => {
    const gallery = { id: "g1", slug: "trip", title: "Trip", isPublished: 1 };
    findFirstGallery.mockResolvedValue(gallery);
    findManyImages.mockResolvedValue([
      {
        id: "i1",
        galleryId: "g1",
        filename: "a.jpg",
        s3Key: "originals/i1.jpg",
        cdnUrl: "https://cdn/originals/i1.jpg",
        thumbnailUrl: "https://cdn/thumbnails/i1.webp",
        displayUrl: "https://cdn/display/i1.webp",
        width: 800,
        height: 600,
        altText: null,
        sortOrder: 0,
        createdAt: "2026-01-01",
      },
    ]);

    const result = await getPublishedGalleryBySlugWithImages("trip");
    expect(result?.gallery).toBe(gallery);
    expect(result?.images).toEqual([
      {
        id: "i1",
        thumbnailUrl: "https://cdn/thumbnails/i1.webp",
        cdnUrl: "https://cdn/originals/i1.jpg",
        displayUrl: "https://cdn/display/i1.webp",
        width: 800,
        height: 600,
        altText: null,
      },
    ]);
    expect(result!.images[0]).not.toHaveProperty("s3Key");
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
