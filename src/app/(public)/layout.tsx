export const dynamic = "force-dynamic";

import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Nav } from "@/components/public/nav";
import { Footer } from "@/components/public/footer";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  let socialLinks: { platform: string; url: string }[] = [];
  try {
    socialLinks = JSON.parse(settings?.socialLinks || "[]");
  } catch {
    socialLinks = [];
  }

  return (
    <>
      <Nav />
      {children}
      <Footer socialLinks={socialLinks} />
    </>
  );
}
