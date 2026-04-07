"use server";

import { db } from "@/db/client";
import { contactSubmissions, siteSettings } from "@/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { SETTINGS_ID } from "@/lib/settings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function submitContactForm(formData: FormData) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, SETTINGS_ID),
  });

  if (!settings?.contactFormEnabled) {
    return { error: "Contact form is currently disabled." };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = (formData.get("phone") as string) || null;
  const sessionType = formData.get("sessionType") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !sessionType || !message) {
    return { error: "Please fill in all required fields." };
  }

  if (!EMAIL_RE.test(email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  // Rate limiting: max 5 submissions per email per hour
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const [result] = await db
    .select({ total: count() })
    .from(contactSubmissions)
    .where(
      and(
        eq(contactSubmissions.email, email.trim()),
        gt(contactSubmissions.createdAt, oneHourAgo)
      )
    );

  if (result.total >= RATE_LIMIT_MAX) {
    return { error: "Too many submissions. Please try again later." };
  }

  await db.insert(contactSubmissions).values({
    id: randomUUID(),
    name: name.trim(),
    email: email.trim(),
    phone: phone ? phone.trim() : null,
    sessionType,
    message: message.trim(),
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}
