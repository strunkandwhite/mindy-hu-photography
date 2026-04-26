export const dynamic = "force-dynamic";

import { getPublishedGalleriesByCategory } from "@/lib/galleries";
import { CategoryGrid } from "@/components/public/category-grid";

export default async function PrintsPage() {
  const galleriesWithCovers = await getPublishedGalleriesByCategory("prints");
  return (
    <div className="min-h-screen">
      <div className="pt-28 px-6">
        <h1 className="text-center font-heading text-2xl text-gray-900 mb-10">Prints</h1>
        <CategoryGrid galleries={galleriesWithCovers} />
      </div>
    </div>
  );
}
