export const dynamic = "force-dynamic";

import { getPublishedGalleriesByCategory } from "@/lib/galleries";
import { CategoryGrid } from "@/components/public/category-grid";

export default async function PlacesPage() {
  const galleriesWithCovers = await getPublishedGalleriesByCategory("places");
  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <h1 className="text-center font-heading text-2xl text-gray-900 mb-10">Places</h1>
        <CategoryGrid galleries={galleriesWithCovers} />
      </div>
    </div>
  );
}
