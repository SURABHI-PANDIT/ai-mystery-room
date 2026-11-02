import { getGeminiClient } from '../ai/geminiClient.js';

export async function generateGeminiVideo(prompt, {
  ai = getGeminiClient(),
  model = process.env.GEMINI_VIDEO_MODEL,
} = {}) {
  const modelName = typeof model === 'string' ? model.trim() : '';
  if (!modelName) {
    const error = new Error('Video generation is not configured.');
    error.code = 'MEDIA_UNAVAILABLE';
    throw error;
  }

  const interaction = await ai.interactions.create({
    model: modelName,
    input: prompt,
    response_format: { type: 'video', resolution: '720p' },
    store: false,
  }, {
    timeout_ms: Number(process.env.GEMINI_VIDEO_TIMEOUT_MS) || 240_000,
    retries: { strategy: 'none' },
  });

  const video = interaction.output_video;
  if (!video?.data) {
    const error = new Error('The video model did not return video bytes.');
    error.code = 'MEDIA_OUTPUT_MISSING';
    throw error;
  }

  const buffer = Buffer.from(video.data, 'base64');
  if (!buffer.length || buffer.length > 80 * 1024 * 1024) {
    const error = new Error('The generated video was empty or too large.');
    error.code = 'MEDIA_OUTPUT_INVALID';
    throw error;
  }
  return { buffer, mimeType: video.mime_type || 'video/mp4' };
}
