import { describe, it, expect } from "vitest";
import { getS3Key, getThumbnailKey } from "../s3";

describe("S3 key generation helpers", () => {
  it("generates correct original key", () => {
    expect(getS3Key("abc-123", "jpg")).toBe("originals/abc-123.jpg");
    expect(getS3Key("xyz", "png")).toBe("originals/xyz.png");
  });

  it("generates correct thumbnail key", () => {
    expect(getThumbnailKey("abc-123")).toBe("thumbnails/abc-123.webp");
  });
});
