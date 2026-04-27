import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAdminAuth, parseJsonBody } from "@/lib/api-helpers";
import { revalidatePath } from "next/cache";

export const PUT = withAdminAuth(async (request) => {
  const parsed = await parseJsonBody<{
    siteTitle?: string;
    tagline?: string;
    aboutText?: string;
    aboutImageUrl?: string | null;
    contactEmail?: string;
    contactFormEnabled?: number;
    socialLinks?: string;
  }>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const updates: Record<string, unknown> = {};
  if (body.siteTitle !== undefined) updates.siteTitle = body.siteTitle;
  if (body.tagline !== undefined) updates.tagline = body.tagline;
  if (body.aboutText !== undefined) updates.aboutText = body.aboutText;
  if (body.aboutImageUrl !== undefined) updates.aboutImageUrl = body.aboutImageUrl;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail;
  if (body.contactFormEnabled !== undefined)
    updates.contactFormEnabled = body.contactFormEnabled;
  if (body.socialLinks !== undefined) updates.socialLinks = body.socialLinks;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  // Get the first (only) settings row
  const rows = await db.select().from(siteSettings).limit(1);
  if (!rows[0]) {
    return Response.json(
      { error: "Settings not found. Run seed first." },
      { status: 404 },
    );
  }

  await db
    .update(siteSettings)
    .set(updates)
    .where(eq(siteSettings.id, rows[0].id));

  const updated = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, rows[0].id))
    .limit(1);

  revalidatePath("/contact");
  revalidatePath("/", "layout");

  return Response.json(updated[0]);
});
