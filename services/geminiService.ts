import { GoogleGenAI, Type } from "@google/genai";
import { APP_CONFIG } from "../config";

const cfg = APP_CONFIG as typeof APP_CONFIG & { API_KEY?: string; GEMINI?: { MODEL_NAME: string; PROMPT: string; TEMPERATURE: number; MAX_TERMS: number } };

const getGeminiClient = () => {
  const apiKey = cfg.API_KEY ?? '';
  if (!apiKey || apiKey.includes('your-') || apiKey.includes('Xxx')) {
    console.warn("Gemini API_KEY missing or placeholder. Add API_KEY and GEMINI to config.ts to use Gemini.");
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
  if (!cfg.GEMINI?.MODEL_NAME || !cfg.API_KEY) {
    console.warn("Gemini not configured. Using CEREBRAS only or add GEMINI to config.ts.");
    return [];
  }
  const client = getGeminiClient();

  try {
    const mimeType = getMimeType(imageBase64);
    
    console.log(`Analyzing image with model: ${cfg.GEMINI.MODEL_NAME}, MimeType: ${mimeType}`);

    const response = await client.models.generateContent({
      model: cfg.GEMINI.MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64(imageBase64),
              mimeType: mimeType, 
            },
          },
          {
            text: cfg.GEMINI.PROMPT,
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
        temperature: cfg.GEMINI.TEMPERATURE,
      },
    });

    const jsonText = response.text;
    console.log("Gemini Raw Response:", jsonText);

    if (!jsonText) return [];

    const terms = JSON.parse(jsonText);
    if (Array.isArray(terms)) {
      return terms.slice(0, cfg.GEMINI.MAX_TERMS);
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