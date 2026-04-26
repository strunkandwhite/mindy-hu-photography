import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

export async function getPublishedGalleriesWithCovers() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
    orderBy: asc(galleries.sortOrder),
  });

  const coverIds = publishedGalleries
    .map((g) => g.coverImageId)
    .filter((id): id is string => id !== null);

  const coverImages =
    coverIds.length > 0
      ? await db.query.images.findMany({
          where: inArray(images.id, coverIds),
        })
      : [];

  const coverMap = new Map(coverImages.map((img) => [img.id, img]));

  return publishedGalleries.map((gallery) => ({
    ...gallery,
    coverImage: gallery.coverImageId ? coverMap.get(gallery.coverImageId) ?? null : null,
  }));
}

const HOMEPAGE_GRID_MAX = 12;

export async function getHomepageGridImages() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
  });

  const galleryMap = new Map(publishedGalleries.map((g) => [g.id, g.slug]));
  const galleryIds = publishedGalleries.map((g) => g.id);
  if (galleryIds.length === 0) return [];

  const allImages = await db.query.images.findMany({
    where: inArray(images.galleryId, galleryIds),
  });

  // Shuffle (Fisher–Yates) so each visit re-orders.
  for (let i = allImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
  }

  return allImages.slice(0, HOMEPAGE_GRID_MAX).map((img) => ({
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
    gallerySlug: img.galleryId ? galleryMap.get(img.galleryId) ?? null : null,
  }));
}
