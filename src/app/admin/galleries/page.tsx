import Link from "next/link";
import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { asc } from "drizzle-orm";

export default async function AdminGalleriesPage() {
  const allGalleries = await db
    .select()
    .from(galleries)
    .orderBy(asc(galleries.sortOrder));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-light text-gray-900">Galleries</h1>
        <Link
          href="/admin/galleries/new"
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          New Gallery
        </Link>
      </div>

      {allGalleries.length === 0 ? (
        <p className="text-sm text-gray-500">No galleries yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {allGalleries.map((gallery) => (
            <div
              key={gallery.id}
              className="py-3 flex items-center justify-between"
            >
              <Link
                href={`/admin/galleries/${gallery.id}`}
                className="text-sm font-medium text-gray-900 hover:underline"
              >
                {gallery.title}
              </Link>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  gallery.isPublished
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {gallery.isPublished ? "Published" : "Draft"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
