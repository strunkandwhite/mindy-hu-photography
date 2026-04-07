export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/public/contact-form";

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <div className="pt-20 px-6">
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-gray-900">Contact</h1>
          <p className="text-sm text-gray-500 mt-2">
            Interested in booking a session? I&apos;d love to hear from you.
          </p>
        </div>
        {settings?.contactFormEnabled ? (
          <ContactForm />
        ) : (
          <p className="text-center text-sm text-gray-400">
            Contact form is currently unavailable.
            {settings?.contactEmail && (
              <> Please reach out at{" "}
                <a href={`mailto:${settings.contactEmail}`} className="text-gray-600 underline">
                  {settings.contactEmail}
                </a>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
