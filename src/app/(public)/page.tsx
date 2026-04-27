export const dynamic = "force-dynamic";

import { getHomepageGridImages } from "@/lib/galleries";
import { HomepageGrid } from "@/components/public/homepage-grid";

const EASTER_EGG = `<!--
    ◇───◇
   / \\ / \\    L E N E H A N — H U
  ◇   ◇   ◇    — A P P L I E D —
   \\ / \\ /      D Y N A M I C S
    ◇───◇
-->`;

export default async function HomePage() {
  const images = await getHomepageGridImages();
  return (
    <>
      <div hidden dangerouslySetInnerHTML={{ __html: EASTER_EGG }} />
      <HomepageGrid images={images} />
    </>
  );
}
