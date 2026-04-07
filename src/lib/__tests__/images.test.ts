import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage } from "../images";

async function createTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("resizes landscape image to 800px on long edge", async () => {
    const input = await createTestImage(1600, 1200);
    const result = await processImage(input);

    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(800);
    expect(thumbMeta.height).toBe(600);
    expect(thumbMeta.format).toBe("webp");
  });

  it("resizes portrait image to 800px on long edge (height)", async () => {
    const input = await createTestImage(900, 1600);
    const result = await processImage(input);

    expect(result.width).toBe(900);
    expect(result.height).toBe(1600);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.height).toBe(800);
    expect(thumbMeta.format).toBe("webp");
  });

  it("resizes square image to 800px on width (>= branch)", async () => {
    const input = await createTestImage(1200, 1200);
    const result = await processImage(input);

    expect(result.width).toBe(1200);
    expect(result.height).toBe(1200);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(800);
    expect(thumbMeta.height).toBe(800);
    expect(thumbMeta.format).toBe("webp");
  });

  it("does not upscale small images", async () => {
    const input = await createTestImage(400, 300);
    const result = await processImage(input);

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(300);
    expect(thumbMeta.format).toBe("webp");
  });
});
