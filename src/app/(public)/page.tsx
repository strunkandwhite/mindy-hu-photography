export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const galleriesWithCovers = await getPublishedGalleriesWithCovers();
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl text-gray-900 tracking-wide">Mindy Hu</h1>
          {settings?.tagline && (
            <p className="text-xs text-gray-400 tracking-widest mt-2">
              {settings.tagline.toUpperCase()}
            </p>
          )}
        </div>
        {galleriesWithCovers.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Portfolio coming soon.</p>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {galleriesWithCovers.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/portfolio/${gallery.slug}`}
                className="group block"
              >
                {gallery.coverImage ? (
                  <div className="relative overflow-hidden">
                    <Image
                      src={gallery.coverImage.thumbnailUrl}
                      alt={gallery.coverImage.altText || gallery.title}
                      width={gallery.coverImage.width}
                      height={gallery.coverImage.height}
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 aspect-[4/3]" />
                )}
                <h2 className="text-xs text-gray-500 tracking-widest mt-3">
                  {gallery.title.toUpperCase()}
                </h2>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
