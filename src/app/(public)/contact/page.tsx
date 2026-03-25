import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ContactForm } from "@/components/public/contact-form";

export default async function ContactPage() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, "default"),
  });

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">Contact</h1>
          <p className="text-sm text-gray-500 mt-2">
            Interested in booking a session? I'd love to hear from you.
          </p>
        </div>
        {settings?.contactFormEnabled ? (
          <ContactForm />
        ) : (
          <p className="text-center text-sm text-gray-400">
            Contact form is currently unavailable. Please reach out via email.
          </p>
        )}
      </div>
    </div>
  );
}
