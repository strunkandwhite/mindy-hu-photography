"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "./lightbox";
import type { PublicGalleryImage } from "@/lib/galleries";

interface GalleryGridProps {
  images: PublicGalleryImage[];
}

export function GalleryGrid({ images }: GalleryGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-3 space-y-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setLightboxIndex(index)}
            className="block w-full break-inside-avoid cursor-pointer"
          >
            <Image
              src={image.thumbnailUrl}
              alt={image.altText || image.filename}
              width={image.width}
              height={image.height}
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
