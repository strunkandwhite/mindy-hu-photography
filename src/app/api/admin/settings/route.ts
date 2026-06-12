import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SETTINGS_ID } from "@/lib/settings";
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

  for (const key of ["siteTitle", "tagline", "aboutText", "contactEmail", "socialLinks"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") {
      return Response.json({ error: `${key} must be a string` }, { status: 400 });
    }
  }

  if (
    body.contactFormEnabled !== undefined &&
    body.contactFormEnabled !== 0 &&
    body.contactFormEnabled !== 1
  ) {
    return Response.json({ error: "contactFormEnabled must be 0 or 1" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.siteTitle !== undefined) updates.siteTitle = body.siteTitle.trim();
  if (body.tagline !== undefined) updates.tagline = body.tagline.trim();
  if (body.aboutText !== undefined) updates.aboutText = body.aboutText.trim();
  if (body.aboutImageUrl !== undefined) updates.aboutImageUrl = body.aboutImageUrl;
  if (body.contactEmail !== undefined) updates.contactEmail = body.contactEmail.trim();
  if (body.contactFormEnabled !== undefined)
    updates.contactFormEnabled = body.contactFormEnabled;
  if (body.socialLinks !== undefined) updates.socialLinks = body.socialLinks;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(siteSettings)
    .set(updates)
    .where(eq(siteSettings.id, SETTINGS_ID))
    .returning();

  if (!updated) {
    return Response.json(
      { error: "Settings not found. Run seed first." },
      { status: 404 },
    );
  }

  revalidatePath("/contact");
  revalidatePath("/", "layout");

  return Response.json(updated);
});
