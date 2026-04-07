"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

interface HeroImage {
  id: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string | null;
  filename: string;
}

interface HeroSlideshowProps {
  images: HeroImage[];
  interval?: number;
}

const FADE_DURATION = 1500;

export function HeroSlideshow({ images, interval = 6000 }: HeroSlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(images.length > 1 ? 1 : 0);
  const [fading, setFading] = useState(false);
  const waitRef = useRef<ReturnType<typeof setTimeout>>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (images.length <= 1) return;
    let cancelled = false;

    function cycle() {
      waitRef.current = setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        fadeRef.current = setTimeout(() => {
          if (cancelled) return;
          setCurrent((prev) => {
            const newCurrent = (prev + 1) % images.length;
            setNext((newCurrent + 1) % images.length);
            return newCurrent;
          });
          setFading(false);
          cycle();
        }, FADE_DURATION);
      }, interval);
    }
    cycle();

    return () => {
      cancelled = true;
      if (waitRef.current) clearTimeout(waitRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [images.length, interval]);

  if (images.length === 0) return null;

  const currentImage = images[current];
  const nextImage = images[next];

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Ken Burns zoom applied to a persistent container — never remounts */}
      <div className="absolute inset-0 animate-[kenburns_20s_ease-in-out_infinite_alternate]">
        {/* Bottom layer: current image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={currentImage.thumbnailUrl}
            alt={currentImage.altText || currentImage.filename}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>

        {/* Top layer: next image, fades in */}
        {images.length > 1 && (
          <div
            className="absolute inset-0 z-10"
            style={{
              opacity: fading ? 1 : 0,
              transition: `opacity ${FADE_DURATION}ms ease-in-out`,
            }}
          >
            <Image
              src={nextImage.thumbnailUrl}
              alt={nextImage.altText || nextImage.filename}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        )}
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 z-20 bg-black/35" />

      {/* Content */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-white">
        <h1 className="font-heading text-4xl md:text-6xl tracking-wide mb-2">
          Mindy Hu
        </h1>
        <p className="text-xs tracking-[0.3em] text-white/70 mb-8">
          PHOTOGRAPHY
        </p>
        <Link
          href="/portfolio"
          className="text-xs tracking-[0.3em] border border-white/60 px-6 py-3 hover:bg-white/10 transition-colors duration-300"
        >
          VIEW PORTFOLIO
        </Link>
      </div>

      {/* Copyright */}
      <p className="absolute bottom-4 left-0 right-0 z-30 text-center text-xs text-white/30">
        &copy; 2026 Mindy Hu Photography
      </p>
    </div>
  );
}
