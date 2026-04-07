import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getS3Key, getThumbnailKey, getCdnUrl } from "../s3";

const originalCloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

beforeEach(() => {
  process.env.CLOUDFRONT_DOMAIN = "cdn.example.com";
});

afterEach(() => {
  if (originalCloudfrontDomain) {
    process.env.CLOUDFRONT_DOMAIN = originalCloudfrontDomain;
  } else {
    delete process.env.CLOUDFRONT_DOMAIN;
  }
});

describe("S3 key generation helpers", () => {
  it("generates correct original key", () => {
    expect(getS3Key("abc-123", "jpg")).toBe("originals/abc-123.jpg");
    expect(getS3Key("xyz", "png")).toBe("originals/xyz.png");
  });

  it("generates correct thumbnail key", () => {
    expect(getThumbnailKey("abc-123")).toBe("thumbnails/abc-123.webp");
  });
});

describe("getCdnUrl", () => {
  it("constructs CloudFront URL from key", () => {
    expect(getCdnUrl("originals/abc.jpg")).toBe("https://cdn.example.com/originals/abc.jpg");
  });
});
