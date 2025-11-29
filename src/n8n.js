import axios from "axios";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

export async function processVehicleImage({
  chatId,
  vehicleImage,
  selectedColor,
  backgroundImage,
}) {
  console.log("📤 Sending to n8n:", {
    chatId,
    vehicleImage,
    selectedColor,
    backgroundImage,
  });

  try {
    const response = await axios.post(
      N8N_WEBHOOK_URL,
      {
        chatId,
        vehicleImage,
        selectedColor,
        backgroundImage: backgroundImage || null,
      },
      {
        timeout: 180000, // 3 minute timeout for AI processing
      }
    );

    console.log("📥 n8n response:", response.data);

    // Handle the response
    if (response.data && response.data.success) {
      return response.data;
    } else if (response.data && response.data.outputImage) {
      // Sometimes the structure might be slightly different
      return { success: true, outputImage: response.data.outputImage };
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

    throw error;
  }
}
