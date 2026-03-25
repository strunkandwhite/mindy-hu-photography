import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";

export default async function AboutPage() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-12 items-start">
          {settings?.aboutImageUrl && (
            <div className="w-full md:w-1/2 flex-shrink-0 relative aspect-[3/4]">
              <Image
                src={settings.aboutImageUrl}
                alt="Mindy Hu"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-heading text-2xl text-gray-900 mb-6">About</h1>
            {settings?.aboutText ? (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {settings.aboutText}
              </p>
            ) : (
              <p className="text-sm text-gray-400">About section coming soon.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
