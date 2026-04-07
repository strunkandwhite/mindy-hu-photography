export const dynamic = "force-dynamic";

import { getHeroImages } from "@/lib/galleries";
import { HeroSlideshow } from "@/components/public/hero-slideshow";

export default async function HomePage() {
  const heroImages = await getHeroImages();

  return (
    <div>
      <HeroSlideshow images={heroImages} />
    </div>
  );
}
