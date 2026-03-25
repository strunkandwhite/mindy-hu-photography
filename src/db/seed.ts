import { db } from "./client";
import { adminUser, siteSettings } from "./schema";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

async function seed() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: tsx src/db/seed.ts <email> <password>");
    process.exit(1);
  }

  const [email, password] = args;

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(adminUser).values({
    id: crypto.randomUUID(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  console.log(`Admin user created: ${email}`);

  await db.insert(siteSettings).values({
    id: "default",
    siteTitle: "Mindy Hu Photography",
    tagline: "",
    homepageHeroImageUrl: null,
    aboutText: "",
    aboutImageUrl: null,
    contactEmail: "",
    contactFormEnabled: 1,
    socialLinks: "[]",
  });

  console.log("Default site settings created.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
