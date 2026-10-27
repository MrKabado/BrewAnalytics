
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from the backend .env file.");
}

const ai = new GoogleGenAI({ apiKey });

export async function testGeminiConnection(): Promise<string> {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    contents:
      "You are the AI assistant for BrewAnalytics, a coffee shop sales analytics system. Reply with one short sentence confirming that you are ready to analyze coffee shop sales data.",
    config: {
      maxOutputTokens: 80,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
