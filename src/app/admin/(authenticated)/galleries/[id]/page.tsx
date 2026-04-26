import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc, ne } from "drizzle-orm";
import GalleryForm from "@/components/admin/gallery-form";
import { DeleteGalleryButton } from "@/components/admin/delete-gallery-button";
import { GalleryImageManager } from "@/components/admin/gallery-image-manager";

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [rows, galleryImages, otherGalleries] = await Promise.all([
    db.select().from(galleries).where(eq(galleries.id, id)).limit(1),
    db.select().from(images).where(eq(images.galleryId, id)).orderBy(asc(images.sortOrder)),
    db
      .select({ id: galleries.id, title: galleries.title })
      .from(galleries)
      .where(ne(galleries.id, id))
      .orderBy(asc(galleries.sortOrder)),
  ]);

  const gallery = rows[0];
  if (!gallery) notFound();

  return (
    <div>
      <h1 className="text-2xl font-light text-gray-900 mb-8">Edit Gallery</h1>

      <GalleryForm
        gallery={{
          id: gallery.id,
          title: gallery.title,
          slug: gallery.slug,
          description: gallery.description,
          isPublished: gallery.isPublished,
        }}
      />

      <div className="mt-12">
        <h2 className="text-lg font-light text-gray-900 mb-4">
          Images ({galleryImages.length})
        </h2>

        <GalleryImageManager
          galleryId={gallery.id}
          coverImageId={gallery.coverImageId}
          images={galleryImages.map((img) => ({
            id: img.id,
            thumbnailUrl: img.thumbnailUrl,
            filename: img.filename,
            altText: img.altText,
          }))}
          otherGalleries={otherGalleries}
        />
      </div>

      <DeleteGalleryButton id={gallery.id} title={gallery.title} />
    </div>
  );
}
