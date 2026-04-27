import sharp from "sharp";

interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
}

const THUMBNAIL_MAX_EDGE = 800;
const THUMBNAIL_QUALITY = 80;

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // sharp(...).rotate() with no args applies EXIF auto-orientation. Reading
  // metadata BEFORE pipeline ops returns input dimensions, which are wrong
  // for orientation 5/6/7/8. Use toBuffer({ resolveWithObject: true }) on
  // the rotated pipeline so info reflects post-rotation dimensions.
  const rotated = sharp(buffer).rotate();
  const { info: srcInfo } = await rotated
    .clone()
    .toBuffer({ resolveWithObject: true });

  const width = srcInfo.width;
  const height = srcInfo.height;

  const longEdge = Math.max(width, height);
  const needsResize = longEdge > THUMBNAIL_MAX_EDGE;

  let pipeline = sharp(buffer).rotate();
  if (needsResize) {
    pipeline = pipeline.resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const thumbnail = await pipeline
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer();

  return { width, height, thumbnail };
}
