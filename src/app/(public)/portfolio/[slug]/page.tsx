export const dynamic = "force-dynamic";

import { db } from "@/db/client";
import { galleries, images } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { GalleryGrid } from "@/components/public/gallery-grid";

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.slug, slug),
  });

  if (!gallery || !gallery.isPublished) notFound();

  const galleryImages = await db.query.images.findMany({
    where: eq(images.galleryId, gallery.id),
    orderBy: asc(images.sortOrder),
  });

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">{gallery.title}</h1>
          {gallery.description && (
            <p className="text-sm text-gray-500 mt-2 max-w-xl mx-auto">{gallery.description}</p>
          )}
        </div>
        <div className="max-w-6xl mx-auto">
          <GalleryGrid images={galleryImages} />
        </div>
      </div>
    </div>
  );
}
