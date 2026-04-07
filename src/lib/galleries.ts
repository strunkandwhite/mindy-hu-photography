import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc, and, gte, inArray } from "drizzle-orm";

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

const HERO_MIN_WIDTH = 1200;
const HERO_MAX_IMAGES = 15;

export async function getHeroImages() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
  });

  const galleryIds = publishedGalleries.map((g) => g.id);
  if (galleryIds.length === 0) return [];

  const allHeroImages = await db.query.images.findMany({
    where: and(
      inArray(images.galleryId, galleryIds),
      gte(images.width, HERO_MIN_WIDTH),
    ),
  });

  // Shuffle so rotation varies across visits
  for (let i = allHeroImages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allHeroImages[i], allHeroImages[j]] = [allHeroImages[j], allHeroImages[i]];
  }

  // Return only what the slideshow needs: limited count, thumbnail URLs for performance
  return allHeroImages.slice(0, HERO_MAX_IMAGES).map((img) => ({
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
  }));
}
