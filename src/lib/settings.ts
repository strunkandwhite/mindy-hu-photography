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
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const getSettings = cache(async () => {
  return db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, SETTINGS_ID),
  });
});
