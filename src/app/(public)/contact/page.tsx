import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/public/contact-form";

export default async function ContactPage() {
  const settings = await getSettings();
  const aboutText = settings?.aboutText;
  const aboutImageUrl = settings?.aboutImageUrl ?? null;
  const contactEmail = settings?.contactEmail;

  return (
    <div className="min-h-screen pt-28 px-6">
      {(aboutText || aboutImageUrl || contactEmail) && (
        <section className="max-w-5xl mx-auto py-10 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 md:gap-12 items-center">
          {aboutImageUrl ? (
            <div className="relative aspect-[3/4] w-full bg-gray-100 overflow-hidden">
              <Image
                src={aboutImageUrl}
                alt="Mindy Hu"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="text-[24px] text-gray-700 leading-9 space-y-4">
            {aboutText && <p className="whitespace-pre-line">{aboutText}</p>}
            {contactEmail && (
              <p>
                For inquiries and rates, please contact{" "}
                <a href={`mailto:${contactEmail}`} className="underline text-gray-900">
                  {contactEmail}
                </a>
                .
              </p>
            )}
          </div>
        </section>
      )}

      {settings?.contactFormEnabled === 1 && (
        <section className="max-w-2xl mx-auto py-12 border-t border-gray-100">
          <h2 className="text-center font-heading text-xl text-gray-900 mb-8">
            Send a message
          </h2>
          <ContactForm />
        </section>
      )}
    </div>
  );
}
