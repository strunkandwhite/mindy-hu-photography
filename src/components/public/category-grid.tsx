import Link from "next/link";
import Image from "next/image";

type GalleryCard = {
  id: string;
  slug: string;
  title: string;
  coverImage: {
    thumbnailUrl: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
};

export function CategoryGrid({ galleries }: { galleries: GalleryCard[] }) {
  if (galleries.length === 0) {
    return <p className="text-center text-sm text-gray-400">No galleries yet.</p>;
  }
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {galleries.map((gallery) => (
        <Link key={gallery.id} href={`/portfolio/${gallery.slug}`} className="group block">
          {gallery.coverImage ? (
            <div className="relative overflow-hidden">
              <Image
                src={gallery.coverImage.thumbnailUrl}
                alt={gallery.coverImage.altText || gallery.title}
                width={gallery.coverImage.width}
                height={gallery.coverImage.height}
                className="w-full object-cover aspect-[3/4] transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-[0.85]"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="absolute inset-0 flex items-end p-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300">
                <h2 className="text-xs text-white tracking-widest">
                  {gallery.title.toUpperCase()}
                </h2>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 aspect-[3/4]" />
          )}
        </Link>
      ))}
    </div>
  );
}
