import { cache } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SETTINGS_ID = "default";

export type SocialLink = {
  platform: string;
  url: string;
};

export function parseSocialLinks(raw: string | null | undefined): SocialLink[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is SocialLink =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { platform?: unknown }).platform === "string" &&
      typeof (item as { url?: unknown }).url === "string" &&
      (item as { platform: string }).platform.length > 0 &&
      (item as { url: string }).url.length > 0,
  );
}

export const getSettings = cache(async () => {
  return db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, SETTINGS_ID),
  });
});
