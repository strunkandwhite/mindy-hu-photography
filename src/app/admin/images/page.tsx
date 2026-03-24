import { db } from "@/db/client";
import { images, galleries } from "@/db/schema";
import { isNull, asc, desc } from "drizzle-orm";
import ImageUploader from "@/components/admin/image-uploader";
import ImageGrid from "@/components/admin/image-grid";

export default async function AdminImagesPage() {
  const [unsortedImages, allGalleries] = await Promise.all([
    db
      .select({
        id: images.id,
        filename: images.filename,
        thumbnailUrl: images.thumbnailUrl,
        altText: images.altText,
      })
      .from(images)
      .where(isNull(images.galleryId))
      .orderBy(desc(images.createdAt)),
    db
      .select({ id: galleries.id, title: galleries.title })
      .from(galleries)
      .orderBy(asc(galleries.sortOrder)),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-light text-gray-900 mb-8">Images</h1>

      <div className="mb-10">
        <h2 className="text-lg font-light text-gray-900 mb-4">Upload</h2>
        <ImageUploader />
      </div>

      <div>
        <h2 className="text-lg font-light text-gray-900 mb-4">
          Unsorted Images ({unsortedImages.length})
        </h2>
        <ImageGrid images={unsortedImages} galleries={allGalleries} />
      </div>
    </div>
  );
}
