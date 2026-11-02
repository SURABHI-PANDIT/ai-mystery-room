import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  caseBlueprintSchema,
  normalizeEvidenceReliability,
  validateBlueprintLogic,
  validateEvidencePlanLogic,
} from '../src/services/ai/schemas.js';
import { generateStructuredOutput } from '../src/services/ai/structuredGeneration.js';
import { blueprint, evidencePlan } from './generationFixtures.js';

test('case schema and semantic validation require one culprit from the suspect set and a consistent timeline', () => {
  const valid = caseBlueprintSchema.parse(blueprint());
  assert.equal(validateBlueprintLogic(valid), valid);
  const unknownCulprit = blueprint();
  unknownCulprit.solution.culpritSuspectId = 'S99';
  assert.throws(() => validateBlueprintLogic(unknownCulprit), /exactly one generated suspect/);
  const unordered = blueprint();
  unordered.timeline.reverse();
  assert.throws(() => validateBlueprintLogic(unordered), /chronological order/);
});

test('evidence validation requires all evidence categories, clue links, and solution support', () => {
  const caseFile = blueprint();
  const links = validateEvidencePlanLogic(evidencePlan(), caseFile);
  assert.deepEqual(links.supportingEvidenceIds, ['E1', 'E4', 'E5']);
  assert.equal(links.misleadingEvidenceExplanations[0].evidenceId, 'E2');
  const missingCctv = evidencePlan();
  missingCctv.evidence = missingCctv.evidence.filter((item) => item.type !== 'cctv');
  assert.throws(() => validateEvidencePlanLogic(missingCctv, caseFile), /two chats, two images, and one CCTV/);
  const danglingClue = evidencePlan();
  danglingClue.evidence[0].clueIds = ['missing'];
  assert.throws(() => validateEvidencePlanLogic(danglingClue, caseFile), /reference clues/);
});

test('evidence timestamps stay consistent with conversation times and related CCTV timeline events', () => {
  const caseFile = blueprint();
  const plan = evidencePlan();
  const cctv = plan.evidence.find((item) => item.type === 'cctv');
  assert.equal(validateEvidencePlanLogic(plan, caseFile).supportingEvidenceIds.includes(cctv.evidenceId), true);

  const cctvTimeMismatch = evidencePlan();
  cctvTimeMismatch.evidence.find((item) => item.type === 'cctv').timestamp = '2026-10-31T20:45:00.000Z';
  assert.throws(() => validateEvidencePlanLogic(cctvTimeMismatch, caseFile), /CCTV recording time must align within 30 minutes/);

  const titleTimeMismatch = evidencePlan();
  titleTimeMismatch.evidence.find((item) => item.type === 'cctv').title = 'North Hall CCTV Footage (11:40 AM - 12:15 PM)';
  assert.throws(() => validateEvidencePlanLogic(titleTimeMismatch, caseFile), /Evidence titles must not repeat clock times/);

  const chatTimeMismatch = evidencePlan();
  chatTimeMismatch.evidence.find((item) => item.type === 'chat').messages.forEach((message, index) => {
    message.timestamp = `2026-11-02T19:0${index}:00.000Z`;
  });
  assert.throws(() => validateEvidencePlanLogic(chatTimeMismatch, caseFile), /within one day of their conversation messages/);
});

test('evidence reliability is anchored to its linked clue instead of contradictory model metadata', () => {
  const caseFile = blueprint();
  const generatedPlan = evidencePlan();
  generatedPlan.evidence[0].reliability = 'contradictory';
  const normalized = normalizeEvidenceReliability(generatedPlan, caseFile);
  assert.equal(normalized.evidence[0].reliability, 'supporting');
  assert.doesNotThrow(() => validateEvidencePlanLogic(normalized, caseFile));
});

test('structured AI generation retries invalid JSON and passes validation feedback to the next attempt', async () => {
  const prompts = [];
  const ai = { interactions: { create: async (request) => {
    prompts.push(request.input);
    return { output_text: prompts.length === 1 ? '{not json' : JSON.stringify(blueprint()) };
  } } };
  const result = await generateStructuredOutput({
    ai, model: 'test-model', systemInstruction: 'test', promptBuilder: (correction) => `prompt ${correction}`,
    jsonSchema: {}, zodSchema: caseBlueprintSchema, semanticValidator: validateBlueprintLogic,
    timeoutMs: 100, maxAttempts: 2,
  });
  assert.equal(result.solution.culpritSuspectId, 'S1');
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /JSON/);
});

test('structured AI generation stops after its configured attempts on invalid output', async () => {
  let calls = 0;
  const ai = { interactions: { create: async () => { calls += 1; return { output_text: 'not json' }; } } };
  await assert.rejects(() => generateStructuredOutput({
    ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
    jsonSchema: {}, zodSchema: caseBlueprintSchema, timeoutMs: 100, maxAttempts: 2,
  }), (error) => error.code === 'INVALID_AI_OUTPUT');
  assert.equal(calls, 2);
});

test('structured AI generation retries transient provider failures', async () => {
  let calls = 0;
  const ai = { interactions: { create: async () => {
    calls += 1;
    if (calls === 1) { const error = new Error('unavailable'); error.status = 503; throw error; }
    return { output_text: JSON.stringify(blueprint()) };
  } } };
  const result = await generateStructuredOutput({
    ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
    jsonSchema: {}, zodSchema: caseBlueprintSchema, semanticValidator: validateBlueprintLogic,
    timeoutMs: 100, maxAttempts: 2,
  });
  assert.equal(result.case.title, 'The Vanishing Ledger');
  assert.equal(calls, 2);
});

test('provider 503 errors keep a safe diagnostic and report a readable overload error', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-secret-key';
  const ai = { interactions: { create: async () => {
    const error = new Error('503 high demand; key=test-secret-key');
    error.status = 503;
    throw error;
  } } };
  try {
    await assert.rejects(() => generateStructuredOutput({
      ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
      jsonSchema: {}, zodSchema: caseBlueprintSchema, timeoutMs: 100, maxAttempts: 1,
    }), (error) => {
      assert.equal(error.code, 'GEMINI_OVERLOADED');
      assert.equal(error.diagnostic.status, 503);
      assert.match(error.diagnostic.diagnostic, /high demand/);
      assert.equal(error.diagnostic.diagnostic.includes('test-secret-key'), false);
      return true;
    });
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('daily quota exhaustion is not retried and includes the provider reset time', async () => {
  let calls = 0;
  const ai = { interactions: { create: async () => {
    calls += 1;
    const error = new Error('429 Rate limit exceeded (limit: 20 requests per day on Free Tier). Please retry in 2h30m or upgrade.');
    error.status = 429;
    throw error;
  } } };
  const startedAt = Date.now();

  await assert.rejects(() => generateStructuredOutput({
    ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
    jsonSchema: {}, zodSchema: caseBlueprintSchema, timeoutMs: 100, maxAttempts: 3,
  }), (error) => {
    assert.equal(error.code, 'GEMINI_DAILY_QUOTA_EXHAUSTED');
    assert.equal(error.diagnostic.status, 429);
    assert.ok(error.diagnostic.retryAvailableAt instanceof Date);
    assert.ok(error.diagnostic.retryAvailableAt.getTime() >= startedAt + (2 * 60 * 60 * 1000) + (29 * 60 * 1000));
    assert.match(error.message, /daily request quota is exhausted/);
    return true;
  });
  assert.equal(calls, 1);
});

test('temporary 429 without a reset time retains normal retry behavior', async () => {
  let calls = 0;
  const ai = { interactions: { create: async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('429 Too many requests in the current interval.');
      error.status = 429;
      throw error;
    }
    return { output_text: JSON.stringify(blueprint()) };
  } } };

  const result = await generateStructuredOutput({
    ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
    jsonSchema: {}, zodSchema: caseBlueprintSchema, semanticValidator: validateBlueprintLogic,
    timeoutMs: 100, maxAttempts: 3,
  });

  assert.equal(result.case.title, 'The Vanishing Ledger');
  assert.equal(calls, 2);
});

test('structured calls use the configured low-thinking option', async () => {
  const previousLevel = process.env.GEMINI_THINKING_LEVEL;
  process.env.GEMINI_THINKING_LEVEL = 'low';
  let sentRequest;
  const ai = { interactions: { create: async (request) => {
    sentRequest = request;
    return { output_text: JSON.stringify(blueprint()) };
  } } };
  try {
    await generateStructuredOutput({
      ai, model: 'test-model', systemInstruction: 'test', promptBuilder: () => 'prompt',
      jsonSchema: {}, zodSchema: caseBlueprintSchema, semanticValidator: validateBlueprintLogic,
      timeoutMs: 100, maxAttempts: 1,
    });
    assert.deepEqual(sentRequest.generation_config, { thinking_level: 'low' });
  } finally {
    if (previousLevel === undefined) delete process.env.GEMINI_THINKING_LEVEL;
    else process.env.GEMINI_THINKING_LEVEL = previousLevel;
  }
});
