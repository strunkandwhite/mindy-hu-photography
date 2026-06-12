// Public pages fall back to the gallery title rather than the raw filename
// (e.g. "DSC_5306.jpg"), which is noise for screen readers and SEO.
export function publicImageAlt(
  image: { altText: string | null },
  galleryTitle: string,
): string {
  return image.altText || `Photograph from the ${galleryTitle} gallery`;
}
