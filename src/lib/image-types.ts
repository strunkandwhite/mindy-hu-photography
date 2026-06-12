export const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
};

export const ACCEPTED_IMAGE_TYPES = Object.keys(IMAGE_EXT_BY_TYPE);
