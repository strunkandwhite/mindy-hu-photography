import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getS3Key, getThumbnailKey, getCdnUrl, getObjectBufferWithSizeCap, ObjectTooLargeError } from "../s3";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

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

describe("getObjectBufferWithSizeCap", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";
  });

  it("throws ObjectTooLargeError when HEAD reports an oversized object", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 31 * 1024 * 1024 });
    await expect(getObjectBufferWithSizeCap("originals/x.jpg")).rejects.toBeInstanceOf(
      ObjectTooLargeError,
    );
    expect(sendMock).toHaveBeenCalledTimes(1); // never attempts the GET
  });

  it("returns the object body when under the cap", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 10 });
    sendMock.mockResolvedValueOnce({
      Body: (async function* () {
        yield new Uint8Array([1, 2, 3]);
      })(),
    });
    const buf = await getObjectBufferWithSizeCap("originals/x.jpg");
    expect([...buf]).toEqual([1, 2, 3]);
  });
});
