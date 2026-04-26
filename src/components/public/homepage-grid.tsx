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

function isLandscape(img: GridImage) {
  return img.width > img.height;
}

const MAX_ROWS = 3;
const IMAGES_PER_ROW = 4;

/**
 * Build rows of 4 images each, alternating H-V-H-V within each row.
 * Picks from horizontal & vertical pools independently per row.
 * Capped at 3 rows.
 */
function buildRows(images: GridImage[]): GridImage[][] {
  const horizontals = images.filter(isLandscape);
  const verticals = images.filter((img) => !isLandscape(img));

  const rows: GridImage[][] = [];
  let hIdx = 0;
  let vIdx = 0;

  for (let row = 0; row < MAX_ROWS; row++) {
    const currentRow: GridImage[] = [];

    for (let col = 0; col < IMAGES_PER_ROW; col++) {
      // Odd rows (0, 2): V at 0,2 — H at 1,3
      // Even rows (1):   H at 0,2 — V at 1,3
      const evenCol = col % 2 === 0;
      const wantH = row % 2 === 0 ? !evenCol : evenCol;

      if (wantH) {
        if (hIdx < horizontals.length) {
          currentRow.push(horizontals[hIdx++]);
        } else if (vIdx < verticals.length) {
          currentRow.push(verticals[vIdx++]);
        }
      } else {
        if (vIdx < verticals.length) {
          currentRow.push(verticals[vIdx++]);
        } else if (hIdx < horizontals.length) {
          currentRow.push(horizontals[hIdx++]);
        }
      }
    }

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Stop if we've exhausted all images
    if (hIdx >= horizontals.length && vIdx >= verticals.length) break;
  }

  return rows;
}

export function HomepageGrid({ images }: { images: GridImage[] }) {
  if (images.length === 0) {
    return (
      <div className="pt-32 text-center text-gray-400 text-sm">
        No images yet — publish a gallery from the admin to see the homepage grid.
      </div>
    );
  }

  const rows = buildRows(images);
  const allImages = rows.flat();

  function renderTile(img: GridImage) {
    const tile = (
      <Image
        src={img.thumbnailUrl}
        alt={img.altText || img.filename}
        width={img.width}
        height={img.height}
        className="w-full h-auto transition-opacity duration-300 hover:opacity-90"
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
      />
    );

    return img.gallerySlug ? (
      <Link href={`/portfolio/${img.gallerySlug}`} className="block">
        {tile}
      </Link>
    ) : (
      tile
    );
  }

  return (
    <div className="pt-24 px-3 max-w-[1400px] mx-auto">
      {/* Mobile & Tablet: responsive grid */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
        {allImages.map((img) => (
          <div key={img.id} className="relative overflow-hidden">
            {renderTile(img)}
          </div>
        ))}
      </div>

      {/* Desktop: justified flex rows */}
      <div className="hidden lg:flex flex-col gap-3">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-3">
            {row.map((img) => {
              const ar = img.width / img.height;
              return (
                <div
                  key={img.id}
                  className="relative overflow-hidden"
                  style={{ flex: `${ar} 1 0%` }}
                >
                  {renderTile(img)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
