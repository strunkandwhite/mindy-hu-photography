import Link from "next/link";
import Image from "next/image";
import { getPublishedGalleriesWithCovers } from "@/lib/galleries";

export default async function PortfolioPage() {
  const galleriesWithCovers = await getPublishedGalleriesWithCovers();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <h1 className="text-center font-heading text-2xl text-gray-900 mb-10">Portfolio</h1>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleriesWithCovers.map((gallery) => (
            <Link key={gallery.id} href={`/portfolio/${gallery.slug}`} className="group block">
              {gallery.coverImage ? (
                <div className="overflow-hidden">
                  <Image
                    src={gallery.coverImage.thumbnailUrl}
                    alt={gallery.coverImage.altText || gallery.title}
                    width={gallery.coverImage.width}
                    height={gallery.coverImage.height}
                    className="w-full object-cover aspect-[3/4] transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 aspect-[3/4]" />
              )}
              <h2 className="text-xs text-gray-500 tracking-widest mt-3">
                {gallery.title.toUpperCase()}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
