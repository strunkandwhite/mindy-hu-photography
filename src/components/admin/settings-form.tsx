"use client";

import { useState, type FormEvent } from "react";
import { parseSocialLinks, type SocialLink } from "@/lib/settings";

type SettingsData = {
  siteTitle: string;
  tagline: string;
  aboutText: string;
  contactEmail: string;
  contactFormEnabled: number;
  socialLinks: string;
};

export default function SettingsForm({
  settings,
}: {
  settings: SettingsData;
}) {
  const [siteTitle, setSiteTitle] = useState(settings.siteTitle);
  const [tagline, setTagline] = useState(settings.tagline);
  const [aboutText, setAboutText] = useState(settings.aboutText);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [contactFormEnabled, setContactFormEnabled] = useState(
    settings.contactFormEnabled === 1,
  );

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(parseSocialLinks(settings.socialLinks));

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addSocialLink() {
    setSocialLinks((prev) => [...prev, { platform: "", url: "" }]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSocialLink(
    index: number,
    field: keyof SocialLink,
    value: string,
  ) {
    setSocialLinks((prev) =>
      prev.map((link, i) =>
        i === index ? { ...link, [field]: value } : link,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteTitle,
          tagline,
          aboutText,
          contactEmail,
          contactFormEnabled: contactFormEnabled ? 1 : 0,
          socialLinks: JSON.stringify(
            socialLinks.filter((l) => l.platform && l.url),
          ),
        }),
      });

      if (res.ok) {
        setMessage("Settings saved.");
      } else {
        const data = await res.json();
        setMessage(data.error ?? "Failed to save.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {message && (
        <div
          className={`text-sm px-3 py-2 rounded border ${
            message === "Settings saved."
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          {message}
        </div>
      )}

      <div>
        <label
          htmlFor="siteTitle"
          className="block text-sm text-gray-700 mb-1"
        >
          Site Title
        </label>
        <input
          id="siteTitle"
          type="text"
          required
          value={siteTitle}
          onChange={(e) => setSiteTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div>
        <label htmlFor="tagline" className="block text-sm text-gray-700 mb-1">
          Tagline
        </label>
        <input
          id="tagline"
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div>
        <label
          htmlFor="aboutText"
          className="block text-sm text-gray-700 mb-1"
        >
          About Text
        </label>
        <textarea
          id="aboutText"
          rows={6}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <div>
        <label
          htmlFor="contactEmail"
          className="block text-sm text-gray-700 mb-1"
        >
          Contact Email
        </label>
        <input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={contactFormEnabled}
          onChange={(e) => setContactFormEnabled(e.target.checked)}
          className="rounded border-gray-300"
        />
        Contact form enabled
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-700">Social Links</span>
          <button
            type="button"
            onClick={addSocialLink}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            + Add link
          </button>
        </div>
        <div className="space-y-2">
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Platform"
                value={link.platform}
                onChange={(e) =>
                  updateSocialLink(i, "platform", e.target.value)
                }
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <input
                type="url"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={() => removeSocialLink(i)}
                className="text-gray-400 hover:text-red-600 text-sm px-1"
              >
                Remove
              </button>
            </div>
          ))}
          {socialLinks.length === 0 && (
            <p className="text-xs text-gray-400">No social links added.</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
