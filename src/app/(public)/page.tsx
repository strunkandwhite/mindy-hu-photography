export const dynamic = "force-dynamic";

import { getHomepageGridImages } from "@/lib/galleries";
import { HomepageGrid } from "@/components/public/homepage-grid";

export default async function HomePage() {
  const images = await getHomepageGridImages();
  return <HomepageGrid images={images} />;
}
