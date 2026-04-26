import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import GalleryForm from "@/components/admin/gallery-form";
import Image from "next/image";
import type { Category } from "@/lib/categories";

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select()
    .from(galleries)
    .where(eq(galleries.id, id))
    .limit(1);

  const gallery = rows[0];
  if (!gallery) notFound();

  const galleryImages = await db
    .select()
    .from(images)
    .where(eq(images.galleryId, id))
    .orderBy(asc(images.sortOrder));

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
          category: gallery.category as Category | null,
        }}
      />

      <div className="mt-12">
        <h2 className="text-lg font-light text-gray-900 mb-4">
          Images ({galleryImages.length})
        </h2>

        {galleryImages.length === 0 ? (
          <p className="text-sm text-gray-500">
            No images in this gallery. Upload images from the Images page and
            assign them here.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {galleryImages.map((img) => (
              <div key={img.id} className="relative group">
                <div className="aspect-square relative rounded overflow-hidden bg-gray-100">
                  <Image
                    src={img.thumbnailUrl}
                    alt={img.altText ?? img.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  />
                </div>
                {gallery.coverImageId === img.id && (
                  <span className="absolute top-1 left-1 text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
