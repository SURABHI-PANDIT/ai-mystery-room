import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generateGeminiImage } from '../src/services/media/geminiImageAdapter.js';
import { generateGeminiVideo } from '../src/services/media/geminiVideoAdapter.js';
import { readMedia, storeMedia } from '../src/services/media/localStorage.js';

test('image adapter requests image output from the configured provider model', async () => {
  const previousModel = process.env.GEMINI_IMAGE_MODEL;
  process.env.GEMINI_IMAGE_MODEL = 'test-image-model';
  const calls = [];
  const ai = { interactions: { create: async (...args) => {
    calls.push(args);
    return { output_image: { data: Buffer.from('image bytes').toString('base64'), mime_type: 'image/jpeg' } };
  } } };
  try {
    const generated = await generateGeminiImage('A fictional archive scene.', { ai });
    assert.equal(generated.buffer.toString(), 'image bytes');
    assert.equal(generated.mimeType, 'image/jpeg');
    assert.equal(calls[0][0].model, 'test-image-model');
    assert.equal(calls[0][0].response_format.type, 'image');
    assert.equal(calls[0][0].response_format.mime_type, 'image/jpeg');
    assert.equal(calls[0][0].store, false);
  } finally {
    if (previousModel === undefined) delete process.env.GEMINI_IMAGE_MODEL;
    else process.env.GEMINI_IMAGE_MODEL = previousModel;
  }
});

test('video adapter requires actual video bytes and requests video output', async () => {
  const previousModel = process.env.GEMINI_VIDEO_MODEL;
  process.env.GEMINI_VIDEO_MODEL = 'test-video-model';
  const calls = [];
  const ai = { interactions: { create: async (...args) => {
    calls.push(args);
    return { output_video: { data: Buffer.from('actual video bytes').toString('base64'), mime_type: 'video/mp4' } };
  } } };
  try {
    const generated = await generateGeminiVideo('A short fictional CCTV clip.', { ai });
    assert.equal(generated.buffer.toString(), 'actual video bytes');
    assert.equal(generated.mimeType, 'video/mp4');
    assert.equal(calls[0][0].model, 'test-video-model');
    assert.equal(calls[0][0].response_format.type, 'video');
    assert.equal(calls[0][0].store, false);
  } finally {
    if (previousModel === undefined) delete process.env.GEMINI_VIDEO_MODEL;
    else process.env.GEMINI_VIDEO_MODEL = previousModel;
  }
});

test('media adapters reject blank model configuration before making provider requests', async () => {
  let calls = 0;
  const ai = { interactions: { create: async () => { calls += 1; } } };
  await assert.rejects(
    () => generateGeminiImage('An evidence photo.', { ai, model: '   ' }),
    (error) => error.code === 'MEDIA_UNAVAILABLE',
  );
  await assert.rejects(
    () => generateGeminiVideo('A CCTV clip.', { ai, model: '   ' }),
    (error) => error.code === 'MEDIA_UNAVAILABLE',
  );
  assert.equal(calls, 0);
});

test('local media storage returns bytes only from an opaque storage reference', async () => {
  const root = await mkdtemp(join(os.tmpdir(), 'mystery-media-'));
  try {
    const stored = await storeMedia(Buffer.from('private media'), 'image/png', root);
    assert.match(stored.storageRef, /^[0-9a-f-]+\.png$/i);
    assert.equal((await readMedia(stored.storageRef, root)).toString(), 'private media');
    await assert.rejects(() => readMedia('..\\secret.png', root), /Invalid media storage reference/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
