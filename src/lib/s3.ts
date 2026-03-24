import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
