import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, and, asc, inArray, sql } from "drizzle-orm";

type Gallery = typeof galleries.$inferSelect;
type Image = typeof images.$inferSelect;

type GalleryWithCover = Gallery & { coverImage: Image | null };

export type PublicGalleryImage = {
  id: string;
  thumbnailUrl: string;
  cdnUrl: string;
  displayUrl: string | null;
  width: number;
  height: number;
  altText: string | null;
};

export type HomepageGridImage = Omit<PublicGalleryImage, "cdnUrl" | "displayUrl"> & {
  gallerySlug: string;
  galleryTitle: string;
};

function toPublicImage(img: Image): PublicGalleryImage {
  return {
    id: img.id,
    thumbnailUrl: img.thumbnailUrl,
    cdnUrl: img.cdnUrl,
    displayUrl: img.displayUrl,
    width: img.width,
    height: img.height,
    altText: img.altText,
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
  return db
    .select({
      id: images.id,
      thumbnailUrl: images.thumbnailUrl,
      width: images.width,
      height: images.height,
      altText: images.altText,
      gallerySlug: galleries.slug,
      galleryTitle: galleries.title,
    })
    .from(images)
    .innerJoin(galleries, eq(images.galleryId, galleries.id))
    .where(and(eq(galleries.isPublished, 1), eq(galleries.showOnHomepage, 1)))
    .orderBy(sql`RANDOM()`)
    .limit(HOMEPAGE_GRID_MAX);
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
