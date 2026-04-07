import sharp from "sharp";

interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
}

const THUMBNAIL_MAX_EDGE = 800;
const THUMBNAIL_QUALITY = 80;

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const longEdge = Math.max(width, height);
  const needsResize = longEdge > THUMBNAIL_MAX_EDGE;

  let thumbnailPipeline = image.clone();

  if (needsResize) {
    if (width >= height) {
      thumbnailPipeline = thumbnailPipeline.resize(THUMBNAIL_MAX_EDGE, null, {
        withoutEnlargement: true,
      });
    } else {
      thumbnailPipeline = thumbnailPipeline.resize(null, THUMBNAIL_MAX_EDGE, {
        withoutEnlargement: true,
      });
    }
  }

  const thumbnail = await thumbnailPipeline
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return { width, height, thumbnail };
}
