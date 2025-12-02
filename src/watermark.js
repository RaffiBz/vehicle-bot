// ============================================
// WATERMARK.JS - Add "Dave Wrap" watermark to images
// ============================================

import sharp from "sharp";
import axios from "axios";

/**
 * Download image and add faded "Dave Wrap" watermark
 * @param {string} imageUrl - URL of the image to watermark
 * @returns {Promise<Buffer>} - Watermarked image buffer
 */
export async function addWatermark(imageUrl) {
  // Download the image
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const imageBuffer = Buffer.from(response.data);

  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 768;

  // Calculate watermark size based on image size
  const fontSize = Math.max(Math.floor(width / 15), 40);
  const padding = Math.floor(fontSize / 2);

  // Create SVG watermark (faded white text with slight shadow)
  const svgWatermark = `
    <svg width="${width}" height="${height}">
      <style>
        .watermark {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: rgba(255, 255, 255, 0.4);
        }
        .shadow {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: rgba(0, 0, 0, 0.2);
        }
      </style>
      <!-- Shadow -->
      <text x="${width - padding + 2}" y="${
    height - padding + 2
  }" text-anchor="end" class="shadow">Dave Wrap</text>
      <!-- Main text -->
      <text x="${width - padding}" y="${
    height - padding
  }" text-anchor="end" class="watermark">Dave Wrap</text>
    </svg>
  `;

  // Composite watermark onto image
  const watermarkedImage = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgWatermark),
        gravity: "southeast",
      },
    ])
    .png()
    .toBuffer();

  return watermarkedImage;
}
