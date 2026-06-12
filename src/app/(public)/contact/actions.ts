"use server";

import { db } from "@/db/client";
import { contactSubmissions } from "@/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getSettings } from "@/lib/settings";
import { SESSION_TYPES, CONTACT_FIELD_LIMITS } from "@/lib/contact";
import { sendContactNotification } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_SESSION_TYPES = new Set<string>(SESSION_TYPES);

// FormData entries can be File objects in a crafted request; only accept strings.
function getStringField(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

export async function submitContactForm(formData: FormData) {
  const settings = await getSettings();

  if (!settings?.contactFormEnabled) {
    return { error: "Contact form is currently disabled." };
  }

  const name = getStringField(formData, "name")?.trim();
  const email = getStringField(formData, "email")?.trim();
  const phone = getStringField(formData, "phone")?.trim() || null;
  const sessionType = getStringField(formData, "sessionType");
  const message = getStringField(formData, "message")?.trim();

  if (!name || !email || !sessionType || !message) {
    return { error: "Please fill in all required fields." };
  }

  if (
    name.length > CONTACT_FIELD_LIMITS.name ||
    email.length > CONTACT_FIELD_LIMITS.email ||
    (phone ? phone.length > CONTACT_FIELD_LIMITS.phone : false) ||
    message.length > CONTACT_FIELD_LIMITS.message
  ) {
    return { error: "One or more fields are too long." };
  }

  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const normalizedEmail = email.toLowerCase();
  if (!ALLOWED_SESSION_TYPES.has(sessionType)) {
    return { error: "Please select a valid session type." };
  }

  // Rate limiting: max 5 submissions per email per hour
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const [result] = await db
    .select({ total: count() })
    .from(contactSubmissions)
    .where(
      and(
        eq(contactSubmissions.email, normalizedEmail),
        gt(contactSubmissions.createdAt, oneHourAgo)
      )
    );

  if (result.total >= RATE_LIMIT_MAX) {
    return { error: "Too many submissions. Please try again later." };
  }

  await db.insert(contactSubmissions).values({
    id: randomUUID(),
    name,
    email: normalizedEmail,
    phone,
    sessionType,
    message,
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  // sendContactNotification never throws (it catches and logs internally).
  // Awaiting it matters: a serverless instance can freeze as soon as the
  // action returns, silently dropping a floating promise.
  await sendContactNotification({
    name,
    email: normalizedEmail,
    phone,
    sessionType,
    message,
  });

  return { success: true };
}
