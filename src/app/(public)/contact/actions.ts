"use server";

import { db } from "@/db/client";
import { contactSubmissions, siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactForm(formData: FormData) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
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
