export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";

export default async function GalleriesPage() {
  const galleries = await getPublishedGalleriesWithCovers();

  return (
    <div className="min-h-screen">
      <div className="pt-28 px-3 max-w-[1400px] mx-auto">
        <h1 className="font-heading text-2xl text-gray-900 text-center mb-10">
          Galleries
        </h1>
        {galleries.length === 0 ? (
          <p className="text-center text-gray-400 text-sm">
            No galleries published yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/portfolio/${gallery.slug}`}
                className="group block"
              >
                <div className="relative overflow-hidden aspect-[4/3] bg-gray-100">
                  {gallery.coverImage ? (
                    <Image
                      src={gallery.coverImage.thumbnailUrl}
                      alt={gallery.title}
                      width={gallery.coverImage.width}
                      height={gallery.coverImage.height}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                      No cover image
                    </div>
                  )}
                </div>
                <h2 className="mt-3 text-sm tracking-wider text-gray-700 group-hover:text-gray-900 transition-colors">
                  {gallery.title}
                </h2>
                {gallery.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                    {gallery.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
