import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getPublishedGalleriesWithCovers() {
  const publishedGalleries = await db.query.galleries.findMany({
    where: eq(galleries.isPublished, 1),
    orderBy: asc(galleries.sortOrder),
  });

  return Promise.all(
    publishedGalleries.map(async (gallery) => {
      let coverImage = null;
      if (gallery.coverImageId) {
        coverImage = await db.query.images.findFirst({
          where: eq(images.id, gallery.coverImageId),
        });
      }
      return { ...gallery, coverImage };
    })
  );
}
