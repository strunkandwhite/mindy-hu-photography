import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendContactNotification } from "@/lib/email";

const submissions: { email: string }[] = [];
let contactFormEnabled = 1;

vi.mock("@/db/client", () => ({
  db: {
    query: {
      siteSettings: {
        findFirst: async () => ({ contactFormEnabled }),
      },
    },
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ total: submissions.length }]),
      }),
    }),
    insert: () => ({ values: async (v: { email: string }) => submissions.push(v) }),
  },
}));

vi.mock("@/lib/email", () => ({
  sendContactNotification: vi.fn(),
}));

const validForm = (overrides: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set("name", "Jane");
  fd.set("email", "jane@example.com");
  fd.set("sessionType", "Family");
  fd.set("message", "Hello there.");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
};

describe("submitContactForm", () => {
  beforeEach(() => {
    submissions.length = 0;
    contactFormEnabled = 1;
    vi.mocked(sendContactNotification).mockClear();
  });

  it("rejects when contact form disabled", async () => {
    contactFormEnabled = 0;
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm());
    expect(result).toEqual({ error: expect.stringMatching(/disabled/i) });
  });

  it("rejects missing fields", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const fd = validForm({ name: "" });
    const result = await submitContactForm(fd);
    expect(result.error).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ email: "not-an-email" }));
    expect(result.error).toMatch(/email/i);
  });

  it("rejects sessionType not in allowlist", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ sessionType: "evil" }));
    expect(result.error).toMatch(/session/i);
  });

  it("normalizes email casing before insert", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    await submitContactForm(validForm({ email: "JANE@Example.com" }));
    expect(submissions[0].email).toBe("jane@example.com");
  });

  it("rejects the 6th submission within the window for the same email", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    for (let i = 0; i < 5; i++) submissions.push({ email: "jane@example.com" });

    const result = await submitContactForm(validForm());
    expect(result.error).toMatch(/too many/i);
    expect(submissions).toHaveLength(5); // nothing inserted
  });

  it("rejects over-length fields", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ message: "x".repeat(5001) }));
    expect(result.error).toMatch(/too long/i);
    expect(submissions).toHaveLength(0);
  });

  it("rejects File entries in string fields without throwing", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const fd = validForm();
    fd.set("name", new Blob(["x"]), "evil.txt");
    const result = await submitContactForm(fd);
    expect(result.error).toMatch(/required/i);
  });

  it("returns success and sends the notification with the stored payload", async () => {
    const { submitContactForm } = await import("@/app/(public)/contact/actions");
    const result = await submitContactForm(validForm({ name: "  Jane  " }));
    expect(result).toEqual({ success: true });
    expect(vi.mocked(sendContactNotification)).toHaveBeenCalledWith({
      name: "Jane",
      email: "jane@example.com",
      phone: null,
      sessionType: "Family",
      message: "Hello there.",
    });
  });
});
