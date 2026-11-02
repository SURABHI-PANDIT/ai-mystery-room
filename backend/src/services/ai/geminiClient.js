import { GoogleGenAI } from '@google/genai';

let client;

export function getGeminiClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Gemini is not configured.');
    error.code = 'GEMINI_NOT_CONFIGURED';
    throw error;
  }

  client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: Number(process.env.GEMINI_TEXT_TIMEOUT_MS) || 60_000,
    },
  });
  return client;
}

export function resetGeminiClientForTests() {
  client = undefined;
}
