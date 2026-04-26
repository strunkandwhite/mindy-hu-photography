import Link from "next/link";
import Image from "next/image";

type GridImage = {
  id: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
  gallerySlug: string | null;
};

// Deterministic span pattern matching the reference rhythm.
// Row sums: each row's col-spans add up to 12. Tiles cycle through this pattern.
const SPANS = [
  "col-span-3",      // tile 0
  "col-span-3",      // 1
  "col-span-3",      // 2
  "col-span-3",      // 3
  "col-span-2",      // 4
  "col-span-3",      // 5
  "col-span-2",      // 6
  "col-span-3",      // 7
  "col-span-2",      // 8
  "col-span-3",      // 9
  "col-span-3",      // 10
  "col-span-3",      // 11
];

export function HomepageGrid({ images }: { images: GridImage[] }) {
  if (images.length === 0) {
    return (
      <div className="pt-32 text-center text-gray-400 text-sm">
        No images yet — publish a gallery from the admin to see the homepage grid.
      </div>
    );
  }
  return (
    <div className="pt-20 px-3 max-w-7xl mx-auto">
      <div className="grid grid-cols-12 gap-2 auto-rows-[180px] md:auto-rows-[220px]">
        {images.map((img, i) => {
          const span = SPANS[i % SPANS.length];
          const tile = (
            <Image
              src={img.thumbnailUrl}
              alt={img.altText || img.filename}
              width={img.width}
              height={img.height}
              className="w-full h-full object-cover transition-opacity duration-300 hover:opacity-90"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          );
          return (
            <div key={img.id} className={`${span} relative overflow-hidden`}>
              {img.gallerySlug ? (
                <Link href={`/portfolio/${img.gallerySlug}`} className="block w-full h-full">
                  {tile}
                </Link>
              ) : (
                tile
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
