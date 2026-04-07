import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

describe("bcrypt hashing", () => {
  it("hashes a password and verifies it with the correct password", async () => {
    const password = "test-password-123";
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const password = "test-password-123";
    const hash = await bcrypt.hash(password, 10);

    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });
});
