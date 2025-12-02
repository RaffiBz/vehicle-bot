// ============================================
// N8N.JS - n8n Webhook Integration
// Handles communication with n8n workflow
// ============================================

import axios from "axios";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * Send vehicle image to n8n for processing
 *
 * @param {Object} params - Processing parameters
 * @param {number} params.chatId - Telegram chat ID
 * @param {string} params.vehicleImage - URL of the vehicle image
 * @param {string} params.selectedColor - Color in ENGLISH (e.g., "red", "blue")
 * @param {string} params.selectedTexture - Texture in ENGLISH ("gloss" or "matte")
 * @returns {Promise<Object>} Result with success status and outputImage URL
 */
export async function processVehicleImage({
  chatId,
  vehicleImage,
  selectedColor,
  selectedTexture,
}) {
  console.log("📤 Sending to n8n:", {
    chatId,
    vehicleImage,
    selectedColor, // English: "red", "blue", etc.
    selectedTexture, // English: "gloss" or "matte"
  });

  try {
    const response = await axios.post(
      N8N_WEBHOOK_URL,
      {
        chatId,
        vehicleImage,
        selectedColor, // Always English for AI
        selectedTexture, // Always English for AI
        // Note: Background removed from flow per client request
      },
      {
        timeout: 180000, // 3 minute timeout for AI processing
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📥 n8n response:", response.data);

    // Handle various response structures
    if (response.data && response.data.success) {
      return response.data;
    } else if (response.data && response.data.outputImage) {
      // Sometimes the structure might be different
      return { success: true, outputImage: response.data.outputImage };
    } else if (response.data && response.data.output) {
      // Alternative output field name
      return { success: true, outputImage: response.data.output };
    } else {
      return {
        success: false,
        error: response.data?.error || "Unknown error from n8n",
      };
    }
  } catch (error) {
    console.error("❌ n8n error:", error.message);

    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Processing timed out. The image may still be processing."
      );
    }

    if (error.response) {
      // Server responded with error
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      throw new Error(`n8n error: ${error.response.status}`);
    }

    throw error;
  }
}
