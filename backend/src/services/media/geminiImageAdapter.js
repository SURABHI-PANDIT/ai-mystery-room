import { getGeminiClient } from '../ai/geminiClient.js';

export async function generateGeminiImage(prompt, {
  ai = getGeminiClient(),
  model = process.env.GEMINI_IMAGE_MODEL,
} = {}) {
  if (!model) {
    const error = new Error('Image generation is not configured.');
    error.code = 'MEDIA_UNAVAILABLE';
    throw error;
  }

  const interaction = await ai.interactions.create({
    model,
    input: prompt,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:3', image_size: '1K' },
    store: false,
  }, {
    timeout_ms: Number(process.env.GEMINI_IMAGE_TIMEOUT_MS) || 90_000,
    retries: { strategy: 'none' },
  });

  const image = interaction.output_image;
  if (!image?.data) {
    const error = new Error('The image model did not return image bytes.');
    error.code = 'MEDIA_OUTPUT_MISSING';
    throw error;
  }

  const buffer = Buffer.from(image.data, 'base64');
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) {
    const error = new Error('The generated image was empty or too large.');
    error.code = 'MEDIA_OUTPUT_INVALID';
    throw error;
  }
  return { buffer, mimeType: image.mime_type || 'image/png' };
}
