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

/**
 * Build rows of `imagesPerRow` images each, alternating H/V slots within each row
 * and flipping the alternation between rows. Picks from horizontal & vertical
 * pools independently; falls back to the other pool when one runs out.
 */
function buildRows(images: GridImage[], imagesPerRow: number): GridImage[][] {
  const horizontals = images.filter(isLandscape);
  const verticals = images.filter((img) => !isLandscape(img));

  const rows: GridImage[][] = [];
  let hIdx = 0;
  let vIdx = 0;

  while (hIdx < horizontals.length || vIdx < verticals.length) {
    const currentRow: GridImage[] = [];
    const rowIdx = rows.length;

    for (let col = 0; col < imagesPerRow; col++) {
      const evenCol = col % 2 === 0;
      const wantH = rowIdx % 2 === 0 ? !evenCol : evenCol;

      if (wantH) {
        if (hIdx < horizontals.length) currentRow.push(horizontals[hIdx++]);
        else if (vIdx < verticals.length) currentRow.push(verticals[vIdx++]);
      } else {
        if (vIdx < verticals.length) currentRow.push(verticals[vIdx++]);
        else if (hIdx < horizontals.length) currentRow.push(horizontals[hIdx++]);
      }
    }

    if (currentRow.length === 0) break;
    rows.push(currentRow);
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

  const desktopRows = buildRows(images, 4);
  const tabletRows = buildRows(images, 2);

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

  function renderRows(rows: GridImage[][]) {
    return rows.map((row, rowIdx) => (
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
    ));
  }

  return (
    <div className="pt-24 px-3 max-w-[1400px] mx-auto">
      {/* Mobile: single-column stack */}
      <div className="md:hidden flex flex-col gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative overflow-hidden">
            {renderTile(img)}
          </div>
        ))}
      </div>

      {/* Tablet: 2-per-row justified mosaic */}
      <div className="hidden md:flex lg:hidden flex-col gap-3">
        {renderRows(tabletRows)}
      </div>

      {/* Desktop: 4-per-row justified mosaic */}
      <div className="hidden lg:flex flex-col gap-3">{renderRows(desktopRows)}</div>
    </div>
  );
}
