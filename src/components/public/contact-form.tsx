"use client";

import { useState } from "react";
import { submitContactForm } from "@/app/(public)/contact/actions";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      const result = await submitContactForm(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-600">Thank you for your message. I&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="max-w-lg mx-auto space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label htmlFor="contact-name" className="block text-xs text-gray-500 tracking-wider mb-1">NAME</label>
        <input
          id="contact-name"
          type="text"
          name="name"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-xs text-gray-500 tracking-wider mb-1">EMAIL</label>
        <input
          id="contact-email"
          type="email"
          name="email"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label htmlFor="contact-phone" className="block text-xs text-gray-500 tracking-wider mb-1">PHONE (OPTIONAL)</label>
        <input
          id="contact-phone"
          type="tel"
          name="phone"
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label htmlFor="contact-session-type" className="block text-xs text-gray-500 tracking-wider mb-1">SESSION TYPE</label>
        <select
          id="contact-session-type"
          name="sessionType"
          required
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="">Select...</option>
          <option value="Portrait">Portrait</option>
          <option value="Family">Family</option>
          <option value="Engagement">Engagement</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-xs text-gray-500 tracking-wider mb-1">MESSAGE</label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 bg-gray-900 text-white text-sm tracking-wider hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Sending..." : "SEND MESSAGE"}
      </button>
    </form>
  );
}
