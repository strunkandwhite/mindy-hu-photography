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

/**
 * Flicker-free crossfade using the "fade out top layer" technique.
 *
 * Both layers are always opacity 1 except during the fade. To transition:
 * 1. Set bottom src to NEXT image (hidden behind opaque top)
 * 2. Fade top layer OUT (1→0), revealing bottom
 * 3. After fade: snap top opacity back to 1 (no transition), set top src = bottom src
 *    Both layers now show the same image — the snap is invisible.
 */
export function HeroSlideshow({ images, interval = 6000 }: HeroSlideshowProps) {
  const [topImage, setTopImage] = useState(images[0]);
  const [bottomImage, setBottomImage] = useState(images[0]);
  const [topOpacity, setTopOpacity] = useState(1);
  const [animate, setAnimate] = useState(false);
  const indexRef = useRef(0);
  const waitRef = useRef<ReturnType<typeof setTimeout>>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (images.length <= 1) return;
    let cancelled = false;

    function cycle() {
      waitRef.current = setTimeout(() => {
        if (cancelled) return;

        // Step 1: Load next image on the bottom layer (hidden behind opaque top)
        const nextIndex = (indexRef.current + 1) % images.length;
        setBottomImage(images[nextIndex]);

        // Step 2: After a frame (so browser loads the new bottom src),
        // enable transition and fade top out
        requestAnimationFrame(() => {
          if (cancelled) return;
          setAnimate(true);
          setTopOpacity(0);

          // Step 3: After fade completes, reset
          fadeRef.current = setTimeout(() => {
            if (cancelled) return;
            indexRef.current = nextIndex;

            // Disable transition, snap top back to opaque, update top src to match bottom
            setAnimate(false);
            setTopImage(images[nextIndex]);
            setTopOpacity(1);

            // Schedule next cycle
            cycle();
          }, FADE_DURATION);
        });
      }, interval);
    }
    cycle();

    return () => {
      cancelled = true;
      if (waitRef.current) clearTimeout(waitRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [images, interval]);

  if (images.length === 0) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Ken Burns zoom on a persistent container */}
      <div className="absolute inset-0 animate-[kenburns_20s_ease-in-out_infinite_alternate]">
        {/* Bottom layer: next image loads here before fade */}
        <div className="absolute inset-0 z-0">
          <Image
            src={bottomImage.thumbnailUrl}
            alt={bottomImage.altText || bottomImage.filename}
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>

        {/* Top layer: fades OUT to reveal bottom */}
        <div
          className="absolute inset-0 z-10"
          style={{
            opacity: topOpacity,
            transition: animate
              ? `opacity ${FADE_DURATION}ms ease-in-out`
              : "none",
          }}
        >
          <Image
            src={topImage.thumbnailUrl}
            alt={topImage.altText || topImage.filename}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
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
