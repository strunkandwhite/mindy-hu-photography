import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import SettingsForm from "@/components/admin/settings-form";
import { parseSocialLinks } from "@/lib/settings";

export default async function AdminSettingsPage() {
  const rows = await db.select().from(siteSettings).limit(1);
  const settings = rows[0];

  if (!settings) {
    return (
      <div>
        <h1 className="text-2xl font-light text-gray-900 mb-8">Settings</h1>
        <p className="text-sm text-gray-500">
          No settings found. Run the database seed first.
        </p>
      </div>
    );
  }

  const socialLinks = parseSocialLinks(settings.socialLinks);

  return (
    <div>
      <h1 className="text-2xl font-light text-gray-900 mb-8">Settings</h1>
      <SettingsForm
        settings={{
          siteTitle: settings.siteTitle,
          tagline: settings.tagline,
          aboutText: settings.aboutText,
          aboutImageUrl: settings.aboutImageUrl,
          contactEmail: settings.contactEmail,
          contactFormEnabled: settings.contactFormEnabled,
        }}
        socialLinks={socialLinks}
      />
    </div>
  );
}
