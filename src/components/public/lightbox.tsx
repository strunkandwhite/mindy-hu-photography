"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import type { PublicGalleryImage } from "@/lib/galleries";
import { publicImageAlt } from "@/lib/image-alt";

interface LightboxProps {
  images: PublicGalleryImage[];
  galleryTitle: string;
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, galleryTitle, currentIndex, onClose, onNavigate }: LightboxProps) {
  const image = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;
  const prevImage = hasPrev ? images[currentIndex - 1] : null;
  const nextImage = hasNext ? images[currentIndex + 1] : null;

  function displaySrc(img: PublicGalleryImage): string {
    return img.displayUrl ?? img.cdnUrl;
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10"
        aria-label="Close lightbox"
      >
        &times;
      </button>

      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 text-white/40 hover:text-white text-3xl z-10"
          aria-label="Previous image"
        >
          &#8249;
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
        <Image
          src={displaySrc(image)}
          alt={publicImageAlt(image, galleryTitle)}
          width={image.width}
          height={image.height}
          className="max-w-full max-h-[90vh] object-contain"
          sizes="90vw"
          preload
        />
      </div>

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 text-white/40 hover:text-white text-3xl z-10"
          aria-label="Next image"
        >
          &#8250;
        </button>
      )}

      <div className="absolute bottom-4 text-white/40 text-xs tracking-wider">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Preload neighbors so arrow-key navigation is instant */}
      <div className="hidden" aria-hidden="true">
        {prevImage && (
          <Image
            src={displaySrc(prevImage)}
            alt=""
            width={prevImage.width}
            height={prevImage.height}
            sizes="90vw"
            preload
          />
        )}
        {nextImage && (
          <Image
            src={displaySrc(nextImage)}
            alt=""
            width={nextImage.width}
            height={nextImage.height}
            sizes="90vw"
            preload
          />
        )}
      </div>
    </div>
  );
}
