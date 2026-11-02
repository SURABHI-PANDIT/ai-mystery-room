import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-2.5-flash';

let client;
let missingTextModelWarningLogged = false;

export function getGeminiTextModel() {
  const configuredModel = process.env.GEMINI_TEXT_MODEL?.trim();
  if (configuredModel) return configuredModel;

  if (!missingTextModelWarningLogged) {
    console.warn(`GEMINI_TEXT_MODEL is missing; using the supported default ${DEFAULT_GEMINI_TEXT_MODEL}.`);
    missingTextModelWarningLogged = true;
  }
  return DEFAULT_GEMINI_TEXT_MODEL;
}

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
