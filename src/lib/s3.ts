import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

export class ObjectTooLargeError extends Error {
  constructor(s3Key: string, size: number, maxBytes: number) {
    super(`Object ${s3Key} is ${size} bytes, exceeding the ${maxBytes}-byte cap`);
    this.name = "ObjectTooLargeError";
  }
}

let _client: S3Client | null = null;
let _bucket: string | null = null;
let _cloudfrontDomain: string | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

function getBucket(): string {
  if (!_bucket) {
    _bucket = process.env.S3_BUCKET!;
  }
  return _bucket;
}

function getCloudfrontDomain(): string {
  if (!_cloudfrontDomain) {
    _cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN!;
  }
  return _cloudfrontDomain;
}

export function getS3Key(imageId: string, ext: string): string {
  return `originals/${imageId}.${ext}`;
}

export function getThumbnailKey(imageId: string): string {
  return `thumbnails/${imageId}.webp`;
}

export function getDisplayKey(imageId: string): string {
  return `display/${imageId}.webp`;
}

export function getCdnUrl(s3Key: string): string {
  return `https://${getCloudfrontDomain()}/${s3Key}`;
}

export async function createPresignedUploadUrl(
  s3Key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 300 });
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  await getClient().send(command);
}

export async function uploadBuffer(
  s3Key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });
  await getClient().send(command);
}

async function getObjectBuffer(s3Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  const response = await getClient().send(command);
  if (!response.Body) throw new Error(`No body for s3://${getBucket()}/${s3Key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getObjectBufferWithSizeCap(
  s3Key: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<Buffer> {
  const head = await getClient().send(
    new HeadObjectCommand({ Bucket: getBucket(), Key: s3Key }),
  );
  const size = head.ContentLength ?? 0;
  if (size > maxBytes) {
    throw new ObjectTooLargeError(s3Key, size, maxBytes);
  }
  return getObjectBuffer(s3Key);
}
