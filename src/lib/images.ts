import sharp from "sharp";

interface ProcessedImage {
  width: number;
  height: number;
  thumbnail: Buffer;
  display: Buffer;
}

const THUMBNAIL_MAX_EDGE = 800;
const THUMBNAIL_QUALITY = 80;
const DISPLAY_MAX_EDGE = 2048;
const DISPLAY_QUALITY = 82;

export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // metadata() reads only the header — no full decode. EXIF orientations
  // 5-8 are 90°/270° rotations, so the rendered axes are swapped relative
  // to the stored dimensions.
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }
  const axesSwapped = (metadata.orientation ?? 1) >= 5;
  const width = axesSwapped ? metadata.height : metadata.width;
  const height = axesSwapped ? metadata.width : metadata.height;

  // .rotate() with no args applies EXIF auto-orientation.
  const base = sharp(buffer).rotate();
  const [thumbnail, display] = await Promise.all([
    base
      .clone()
      .resize(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer(),
    base
      .clone()
      .resize(DISPLAY_MAX_EDGE, DISPLAY_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: DISPLAY_QUALITY })
      .toBuffer(),
  ]);

  return { width, height, thumbnail, display };
}
