import { GoogleGenAI, Type } from "@google/genai";
import { APP_CONFIG } from "../config";

const getGeminiClient = () => {
  const apiKey = APP_CONFIG.API_KEY;
  if (!apiKey || apiKey.includes('Xxx')) {
    console.warn("API_KEY appears to be invalid or a placeholder. Please check config.ts.");
    // We continue to return the client to let the API throw the actual authentication error for debugging
  }
  return new GoogleGenAI({ apiKey });
};

// Convert base64 string (with data URI prefix) to raw base64
const cleanBase64 = (dataUrl: string) => {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] : dataUrl;
};

// Extract mime type from base64 string
const getMimeType = (dataUrl: string) => {
  const match = dataUrl.match(/:(.*?);/);
  return match ? match[1] : 'image/jpeg';
};

export const generateDesignTerms = async (imageBase64: string): Promise<string[]> => {
  const client = getGeminiClient();

  try {
    const mimeType = getMimeType(imageBase64);
    
    console.log(`Analyzing image with model: ${APP_CONFIG.GEMINI.MODEL_NAME}, MimeType: ${mimeType}`);

    const response = await client.models.generateContent({
      model: APP_CONFIG.GEMINI.MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64(imageBase64),
              mimeType: mimeType, 
            },
          },
          {
            text: APP_CONFIG.GEMINI.PROMPT,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING
            }
        },
        temperature: APP_CONFIG.GEMINI.TEMPERATURE,
      },
    });

    const jsonText = response.text;
    console.log("Gemini Raw Response:", jsonText);

    if (!jsonText) return [];

    const terms = JSON.parse(jsonText);
    if (Array.isArray(terms)) {
      return terms.slice(0, APP_CONFIG.GEMINI.MAX_TERMS);
    }
    return [];

  } catch (error: any) {
    console.error("Gemini API Error Details:", error);
    
    // Provide more specific fallback tags based on the error
    if (error.toString().includes('400') || error.toString().includes('API key')) {
      return ["Invalid API Key", "Check Config"];
    }
    
    return ["Analysis Failed", "Retry Later"];
  }
};