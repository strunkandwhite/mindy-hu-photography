"use server";

import { db } from "@/db/client";
import { contactSubmissions, siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

function sanitize(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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

  const sanitizedName = sanitize(name.trim());
  const sanitizedEmail = sanitize(email.trim());
  const sanitizedPhone = phone ? sanitize(phone.trim()) : null;
  const sanitizedMessage = sanitize(message.trim());
  const sanitizedSessionType = sanitize(sessionType);

  await db.insert(contactSubmissions).values({
    id: randomUUID(),
    name: sanitizedName,
    email: sanitizedEmail,
    phone: sanitizedPhone,
    sessionType: sanitizedSessionType,
    message: sanitizedMessage,
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}
