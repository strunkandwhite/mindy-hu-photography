import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { GalleryGrid } from "@/components/public/gallery-grid";
import { getPublishedGalleryBySlugWithImages } from "@/lib/galleries";

export async function generateStaticParams() {
  const published = await db
    .select({ slug: galleries.slug })
    .from(galleries)
    .where(eq(galleries.isPublished, 1));
  return published.map((g) => ({ slug: g.slug }));
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublishedGalleryBySlugWithImages(slug);
  if (!result) notFound();
  const { gallery, images: galleryImages } = result;

  return (
    <div className="min-h-screen">
      <div className="pt-28 px-6">
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
