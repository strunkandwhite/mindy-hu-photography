import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

export type Gallery = typeof galleries.$inferSelect;
export type Image = typeof images.$inferSelect;

export type GalleryWithCover = Gallery & { coverImage: Image | null };

export type PublicGalleryImage = {
  id: string;
  thumbnailUrl: string;
  cdnUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
};

export type HomepageGridImage = Omit<PublicGalleryImage, "cdnUrl"> & {
  gallerySlug: string | null;
};

function toPublicImage(img: Image): PublicGalleryImage {
  return {
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    cdnUrl: img.cdnUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
    filename: img.filename,
  };
}

export async function getPublishedGalleriesWithCovers(): Promise<GalleryWithCover[]> {
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

export async function getHomepageGridImages(): Promise<HomepageGridImage[]> {
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

export async function getPublishedGalleryBySlugWithImages(
  slug: string,
): Promise<{ gallery: Gallery; images: PublicGalleryImage[] } | null> {
  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.slug, slug),
  });
  if (!gallery || !gallery.isPublished) return null;

  const galleryImages = await db.query.images.findMany({
    where: eq(images.galleryId, gallery.id),
    orderBy: asc(images.sortOrder),
  });

  return { gallery, images: galleryImages.map(toPublicImage) };
}
