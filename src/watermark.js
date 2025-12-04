// ============================================
// WATERMARK.JS - Add tiled "Dave Wrap" watermark to images
// Optimized for low memory usage
// ============================================

import sharp from "sharp";
import axios from "axios";

/**
 * Download image and add tiled "Dave Wrap" watermark pattern
 * @param {string} imageUrl - URL of the image to watermark
 * @returns {Promise<Buffer>} - Watermarked image buffer
 */
export async function addWatermark(imageUrl) {
  // Download the image with timeout
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 30000, // 30 second timeout
  });
  const imageBuffer = Buffer.from(response.data);

  // Get image dimensions (don't load full image into memory yet)
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 768;

  // Watermark settings
  const fontSize = 48;
  const spacingX = 400;
  const spacingY = 300;
  const angle = -35;

  let watermarkTexts = "";
  let row = 0;

  for (let y = 100; y < height; y += spacingY) {
    const offsetX = row % 2 === 0 ? 0 : spacingX / 2;
    for (let x = 50 + offsetX; x < width; x += spacingX) {
      watermarkTexts += `<text x="${x}" y="${y}" text-anchor="middle" transform="rotate(${angle}, ${x}, ${y})">Dave Wrap</text>\n`;
    }
    row++;
  }

  const svgWatermark = `<svg width="${width}" height="${height}">
  <style>
    text {
      font-family: Georgia, serif;
      font-size: ${fontSize}px;
      font-style: italic;
      fill: rgba(128, 128, 128, 0.35);
    }
  </style>
  ${watermarkTexts}
</svg>`;

  // Process with memory optimizations
  const watermarkedImage = await sharp(imageBuffer, {
    sequentialRead: true, // Lower memory usage - reads in chunks
  })
    .composite([
      {
        input: Buffer.from(svgWatermark),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 85 }) // JPEG is smaller than PNG, faster to send
    .toBuffer();

  // Help garbage collection
  imageBuffer.fill(0);

  return watermarkedImage;
}
