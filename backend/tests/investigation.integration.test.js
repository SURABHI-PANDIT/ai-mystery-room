import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { Evidence } from '../src/models/Evidence.js';
import { Investigation } from '../src/models/Investigation.js';
import { User } from '../src/models/User.js';
import { createInvestigationsRouter } from '../src/routes/investigations.js';
import { DEFAULT_GEMINI_TEXT_MODEL } from '../src/services/ai/geminiClient.js';
import { runInvestigationGeneration } from '../src/services/investigation/generationService.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../src/utils/auth.js';
import { blueprint, evidencePlan } from './generationFixtures.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);
const email = `generation-${randomUUID()}@example.test`;
const otherEmail = `generation-other-${randomUUID()}@example.test`;
const password = 'Mystery-Room-Integration-Password-42';
let users = [];
const queuedIds = [];
const app = createApp({ investigations: createInvestigationsRouter({ scheduleGeneration: (id) => queuedIds.push(id) }) });

before(async () => {
  await connectDatabase();
  users = await User.create([
    { name: 'Generator Owner', email, passwordHash: await bcrypt.hash(password, 12) },
    { name: 'Other Owner', email: otherEmail, passwordHash: await bcrypt.hash(password, 12) },
  ]);
});

after(async () => {
  const investigationIds = await Investigation.find({ userId: { $in: users.map(({ _id }) => _id) } }).distinct('_id');
  await Evidence.deleteMany({ investigationId: { $in: investigationIds } });
  await Investigation.deleteMany({ _id: { $in: investigationIds } });
  await User.deleteMany({ _id: { $in: users.map(({ _id }) => _id) } });
  await mongoose.disconnect();
});

function clientFor(user) {
  return request.agent(app).set('Cookie', `${AUTH_COOKIE_NAME}=${createSessionToken(user._id.toString())}`);
}

async function createAccusationCase(user) {
  const investigation = await Investigation.create({
    userId: user._id,
    scenario: 'A sealed collection case was opened during a private museum reception.',
    title: 'The Sealed Collection',
    description: 'A valuable collection vanished.',
    incidentSummary: 'The collection disappeared from a locked gallery.',
    status: 'Ready',
    suspects: [
      { suspectId: 'S1', name: 'Ada Vale', age: 35, occupation: 'Archivist', biography: 'Gallery archivist.', relationshipToIncident: 'Controlled the archive.', motive: 'A debt.', alibi: 'Claims she was in the reading room.', background: 'Knows the locks.' },
      { suspectId: 'S2', name: 'Bram Cole', age: 42, occupation: 'Guard', biography: 'Night guard.', relationshipToIncident: 'Patrolled the gallery.', motive: 'A dispute.', alibi: 'Claims he stayed at the entrance.', background: 'Knows the cameras.' },
    ],
    timeline: [{ eventId: 'T1', occurredAt: new Date('2026-10-31T20:00:00Z'), description: 'The gallery was locked.', suspectIds: ['S1', 'S2'] }],
    cluePlan: [{ clueId: 'C1', description: 'The access log shows Ada used the copied key.', classification: 'supporting', explanation: 'The key access contradicts her alibi.', suspectIds: ['S1'] }],
    solution: {
      culpritSuspectId: 'S1',
      crimeExplanation: 'Ada used her archive key to remove the collection.',
      actualSequenceOfEvents: ['Ada unlocked the gallery.', 'She removed the collection before the alarm reset.'],
      supportingClueIds: ['C1'],
      supportingEvidenceIds: ['E1'],
      misleadingEvidenceExplanations: [{ evidenceId: 'E2', explanation: 'The guard was nearby but did not enter the gallery.' }],
      finalExplanation: 'The access record and timeline establish Ada\'s opportunity.',
    },
  });
  await Evidence.create([
    { evidenceId: 'E1', investigationId: investigation._id, type: 'chat', title: 'Access message', description: 'A message places Ada near the archive.', content: { messages: [] }, reliability: 'supporting', internalPurpose: 'It contradicts Ada\'s stated alibi.', associatedSuspectIds: ['S1'], timestamp: new Date('2026-10-31T19:30:00Z'), displayOrder: 1, generationStatus: 'ready' },
    { evidenceId: 'E2', investigationId: investigation._id, type: 'image', title: 'Hallway still', description: 'A still shows Bram in the corridor.', content: {}, reliability: 'misleading', internalPurpose: 'It is consistent with Bram\'s ordinary patrol.', associatedSuspectIds: ['S2'], timestamp: new Date('2026-10-31T19:45:00Z'), displayOrder: 2, generationStatus: 'failed' },
  ]);
  return investigation;
}

test('async generation persists a validated case/evidence set and protects solution and media ownership', async () => {
  const owner = clientFor(users[0]);
  const otherOwner = clientFor(users[1]);
  const scenario = 'A priceless ledger disappeared from a locked archive during a private reception.';
  const submitted = await owner.post('/api/investigations').send({ scenario });
  assert.equal(submitted.status, 202);
  const investigationId = submitted.body.data.investigation.id;
  assert.deepEqual(queuedIds, [investigationId]);
  assert.equal((await otherOwner.get(`/api/investigations/${investigationId}/status`)).status, 404);

  let aiCalls = 0;
  const requestedModels = [];
  const ai = { interactions: { create: async (requestConfig) => {
    aiCalls += 1;
    requestedModels.push(requestConfig.model);
    return { output_text: JSON.stringify(aiCalls === 1 ? blueprint() : evidencePlan()) };
  } } };
  const previousTextModel = process.env.GEMINI_TEXT_MODEL;
  try {
    delete process.env.GEMINI_TEXT_MODEL;
    await runInvestigationGeneration(investigationId, {
      ai,
      providers: {
        generateImage: async () => ({ buffer: Buffer.from('fake image bytes'), mimeType: 'image/png' }),
        generateVideo: async () => ({ buffer: Buffer.from('fake video bytes'), mimeType: 'video/mp4' }),
        storeMedia: async (_buffer, mimeType) => ({ mediaId: randomUUID(), storageRef: `${randomUUID()}.${mimeType === 'video/mp4' ? 'mp4' : 'png'}`, mimeType }),
      },
    });
  } finally {
    if (previousTextModel === undefined) delete process.env.GEMINI_TEXT_MODEL;
    else process.env.GEMINI_TEXT_MODEL = previousTextModel;
  }

  const status = await owner.get(`/api/investigations/${investigationId}/status`);
  assert.equal(status.status, 200);
  assert.equal(status.body.data.status, 'Ready');
  assert.equal(aiCalls, 2);
  assert.equal(requestedModels.length, 2);
  assert.deepEqual(requestedModels, [DEFAULT_GEMINI_TEXT_MODEL, DEFAULT_GEMINI_TEXT_MODEL]);

  const caseResponse = await owner.get(`/api/investigations/${investigationId}`);
  assert.equal(caseResponse.status, 200);
  const publicCase = caseResponse.body.data.investigation;
  assert.equal(publicCase.suspects.length, 3);
  assert.equal('scenario' in publicCase, false);
  assert.equal('cluePlan' in publicCase, false);
  assert.equal('solution' in publicCase, false);
  assert.equal(JSON.stringify(publicCase).includes('culpritSuspectId'), false);
  const storedCase = await Investigation.findById(investigationId).select('+scenario +cluePlan +solution');
  assert.equal(storedCase.scenario, scenario);
  assert.equal(storedCase.solution.culpritSuspectId, 'S1');
  assert.equal(storedCase.cluePlan.length, 4);

  const evidenceResponse = await owner.get(`/api/investigations/${investigationId}/evidence`);
  assert.equal(evidenceResponse.status, 200);
  const publicEvidence = evidenceResponse.body.data.evidence;
  assert.equal(publicEvidence.length, 5);
  assert.equal(publicEvidence.filter((item) => item.type === 'chat').length, 2);
  assert.equal(publicEvidence.filter((item) => item.type === 'image').length, 2);
  assert.equal(publicEvidence.filter((item) => item.type === 'cctv').length, 1);
  const recording = publicEvidence.find((item) => item.type === 'cctv');
  assert.equal(new Date(recording.timestamp).toISOString(), new Date(recording.content.recordedAt).toISOString());
  const matchingTimelineEvent = caseResponse.body.data.investigation.timeline.find((event) => (
    event.suspectIds.some((suspectId) => recording.associatedSuspectIds.includes(suspectId))
    && Math.abs(new Date(event.occurredAt).getTime() - new Date(recording.timestamp).getTime()) <= 30 * 60 * 1000
  ));
  assert.ok(matchingTimelineEvent, 'CCTV timestamp should match a related event in the case timeline.');
  assert.ok(publicEvidence.every((item) => !('internalPurpose' in item) && !('reliability' in item) && !('clueIds' in item)));
  assert.ok(publicEvidence.flatMap((item) => item.media).every((media) => !('storageRef' in media)));
  const media = publicEvidence.flatMap((item) => item.media);
  assert.equal(media.length, 3);
  assert.ok(media.every((item) => item.generationStatus === 'ready'));
  assert.equal((await otherOwner.get(media[0].url)).status, 404);
});

test('failed image and video requests are marked honestly without generating substitute media', async () => {
  const owner = clientFor(users[0]);
  const investigation = await Investigation.create({
    userId: users[0]._id, scenario: 'A failed media generation case with enough scenario details.',
    title: 'Generating case', description: 'Pending', status: 'Generating',
  });
  let aiCall = 0;
  const ai = { interactions: { create: async () => ({ output_text: JSON.stringify(aiCall++ === 0 ? blueprint() : evidencePlan()) }) } };
  await runInvestigationGeneration(investigation._id.toString(), {
    ai,
    providers: {
      generateImage: async () => { throw new Error('simulated provider failure'); },
      generateVideo: async () => { const error = new Error('Rate limit exceeded (limit: 0 requests per day on Free Tier).'); error.status = 429; throw error; },
      storeMedia: async () => { throw new Error('storeMedia should not be called'); },
    },
  });
  const response = await owner.get(`/api/investigations/${investigation._id}/evidence`);
  assert.equal(response.status, 200);
  const generated = response.body.data.evidence;
  assert.equal(generated.filter((item) => item.type === 'image').every((item) => item.generationStatus === 'failed' && item.media.length === 0), true);
  const cctv = generated.find((item) => item.type === 'cctv');
  assert.equal(cctv.generationStatus, 'unavailable');
  assert.equal(cctv.media.length, 0);
  assert.match(cctv.generationMessage, /unavailable on the current Gemini API plan/);
});

test('invalid AI output is reported safely and a failed case can be queued for retry', async () => {
  const owner = clientFor(users[0]);
  const submitted = await owner.post('/api/investigations').send({
    scenario: 'A sealed archive room was found empty after a private evening event.',
  });
  assert.equal(submitted.status, 202);
  const investigationId = submitted.body.data.investigation.id;
  const ai = { interactions: { create: async () => ({ output_text: 'provider raw response must not escape' }) } };
  await runInvestigationGeneration(investigationId, { ai });

  const status = await owner.get(`/api/investigations/${investigationId}/status`);
  assert.equal(status.status, 200);
  assert.equal(status.body.data.status, 'Failed');
  assert.match(status.body.data.error, /did not pass consistency checks/);
  assert.equal(JSON.stringify(status.body).includes('provider raw response'), false);

  const retry = await owner.post(`/api/investigations/${investigationId}/retry`);
  assert.equal(retry.status, 202);
  assert.equal(retry.body.data.investigation.status, 'Generating');
  assert.equal(queuedIds.includes(investigationId), true);
  const reset = await Investigation.findById(investigationId).select('+scenario +solution +cluePlan');
  assert.equal(reset.status, 'Generating');
  assert.equal(reset.solution, undefined);
  assert.equal(reset.cluePlan.length, 0);
});

test('provider overload is saved as a safe actionable status and retains a server diagnostic', async () => {
  const owner = clientFor(users[0]);
  const investigation = await Investigation.create({
    userId: users[0]._id, scenario: 'A rare manuscript vanished from a locked room after closing.',
    title: 'Generating case', status: 'Generating',
  });
  let calls = 0;
  const ai = { interactions: { create: async () => {
    calls += 1;
    const error = new Error('503 model is experiencing high demand.');
    error.status = 503;
    throw error;
  } } };
  await runInvestigationGeneration(investigation._id.toString(), { ai });

  const response = await owner.get(`/api/investigations/${investigation._id}/status`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'Failed');
  assert.match(response.body.data.error, /Gemini is busy right now/);
  assert.equal(JSON.stringify(response.body).includes('high demand'), false);
  assert.equal(calls, 3);
  const stored = await Investigation.findById(investigation._id).select('+generationError.code +generationError.detail');
  assert.equal(stored.generationError.code, 'GEMINI_OVERLOADED');
  assert.match(stored.generationError.detail, /high demand/);
});

test('daily quota reset time is persisted, returned safely, and prevents premature retry', async () => {
  const owner = clientFor(users[0]);
  const submitted = await owner.post('/api/investigations').send({
    scenario: 'A sealed evidence cabinet was found open after the museum closed for the night.',
  });
  assert.equal(submitted.status, 202);
  const investigationId = submitted.body.data.investigation.id;
  let calls = 0;
  const ai = { interactions: { create: async () => {
    calls += 1;
    const error = new Error('429 Rate limit exceeded (limit: 20 requests per day on Free Tier). Retry in 2h30m.');
    error.status = 429;
    throw error;
  } } };
  await runInvestigationGeneration(investigationId, { ai });

  const status = await owner.get(`/api/investigations/${investigationId}/status`);
  assert.equal(status.status, 200);
  assert.equal(status.body.data.status, 'Failed');
  assert.match(status.body.data.error, /daily request quota is exhausted/);
  assert.ok(Date.parse(status.body.data.retryAvailableAt) > Date.now());
  assert.equal(calls, 1);

  const stored = await Investigation.findById(investigationId).select('+generationError.code +generationError.retryAvailableAt');
  assert.equal(stored.generationError.code, 'GEMINI_DAILY_QUOTA_EXHAUSTED');
  assert.ok(stored.generationError.retryAvailableAt instanceof Date);

  const queuedCountBeforeRetry = queuedIds.filter((id) => id === investigationId).length;
  const retry = await owner.post(`/api/investigations/${investigationId}/retry`);
  assert.equal(retry.status, 429);
  assert.equal(retry.body.error.code, 'RETRY_NOT_AVAILABLE');
  assert.equal(retry.body.data.retryAvailableAt, status.body.data.retryAvailableAt);
  assert.equal(queuedIds.filter((id) => id === investigationId).length, queuedCountBeforeRetry);
});

test('correct accusation completes once, scores reviewed evidence, protects ownership, and reveals the solution', async () => {
  const investigation = await createAccusationCase(users[0]);
  const owner = clientFor(users[0]);
  const otherOwner = clientFor(users[1]);
  const caseResponse = await owner.get(`/api/investigations/${investigation._id}`);
  assert.equal(caseResponse.status, 200);
  assert.equal(JSON.stringify(caseResponse.body).includes('culpritSuspectId'), false);
  assert.equal((await owner.get(`/api/investigations/${investigation._id}/result`)).status, 409);
  const readyEvidence = await owner.get(`/api/investigations/${investigation._id}/evidence`);
  assert.equal(readyEvidence.status, 200);
  assert.equal(readyEvidence.body.data.evidence.length, 2);
  assert.equal(JSON.stringify(readyEvidence.body).includes('internalPurpose'), false);
  assert.equal(JSON.stringify(readyEvidence.body).includes('culpritSuspectId'), false);
  assert.equal((await otherOwner.get(`/api/investigations/${investigation._id}/evidence`)).status, 404);
  assert.equal((await request(app).post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'S1' })).status, 401);
  assert.equal((await otherOwner.post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'S1' })).status, 404);
  assert.equal((await otherOwner.post(`/api/investigations/${investigation._id}/evidence/E1/viewed`)).status, 404);
  assert.equal((await owner.post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'OTHER' })).status, 400);

  const viewed = await owner.post(`/api/investigations/${investigation._id}/evidence/E1/viewed`);
  assert.equal(viewed.status, 200);
  assert.deepEqual(viewed.body.data.reviewedEvidenceIds, ['E1']);
  assert.equal((await owner.get(`/api/investigations/${investigation._id}/evidence`)).status, 200);
  assert.equal((await owner.post(`/api/investigations/${investigation._id}/evidence/OTHER/viewed`)).status, 404);

  const accusation = await owner.post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'S1' });
  assert.equal(accusation.status, 201);
  assert.equal(accusation.body.data.result.isCorrect, true);
  assert.equal(accusation.body.data.result.actualCulpritName, 'Ada Vale');
  assert.deepEqual(accusation.body.data.result.score, {
    total: 85, maximum: 100, accusationPoints: 70, evidencePoints: 15,
    reviewedEvidenceCount: 1, availableEvidenceCount: 2,
  });
  assert.match(accusation.body.data.result.supportingEvidence[0].explanation, /contradicts Ada/);
  assert.match(accusation.body.data.result.supportingClues[0].explanation, /contradicts her alibi/);
  assert.equal(accusation.body.data.result.misleadingEvidenceExplanations[0].title, 'Hallway still');

  const duplicate = await owner.post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'S2' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'ACCUSATION_ALREADY_SUBMITTED');
  assert.equal((await otherOwner.get(`/api/investigations/${investigation._id}/result`)).status, 404);
  assert.equal((await owner.get(`/api/investigations/${investigation._id}/status`)).body.data.status, 'Completed');
  const completedEvidence = await owner.get(`/api/investigations/${investigation._id}/evidence`);
  assert.equal(completedEvidence.status, 200);
  assert.deepEqual(
    completedEvidence.body.data.evidence.map((item) => item.evidenceId),
    readyEvidence.body.data.evidence.map((item) => item.evidenceId),
  );
  assert.equal((await otherOwner.get(`/api/investigations/${investigation._id}/evidence`)).status, 404);
  const history = await owner.get('/api/investigations');
  assert.equal(history.body.data.investigations.find((item) => item.id === investigation._id.toString()).status, 'Completed');
  const completedCase = await owner.get(`/api/investigations/${investigation._id}`);
  assert.equal(completedCase.status, 200);
  assert.equal(JSON.stringify(completedCase.body).includes('actualCulpritName'), false);
  assert.equal(JSON.stringify(completedCase.body).includes('Ada used her archive key'), false);

  const saved = await Investigation.findById(investigation._id).select('+solution +accusation +result');
  assert.equal(saved.status, 'Completed');
  assert.equal(saved.accusation.selectedSuspectId, 'S1');
  assert.equal(saved.result.score.total, 85);
  assert.equal(JSON.stringify((await owner.get(`/api/investigations/${investigation._id}/status`)).body).includes('Ada Vale'), false);
});

test('incorrect accusation is final and returns a backend-computed result and score', async () => {
  const investigation = await createAccusationCase(users[0]);
  const owner = clientFor(users[0]);
  await owner.post(`/api/investigations/${investigation._id}/evidence/E1/viewed`);
  await owner.post(`/api/investigations/${investigation._id}/evidence/E2/viewed`);

  const response = await owner.post(`/api/investigations/${investigation._id}/accuse`).send({ selectedSuspectId: 'S2' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.result.isCorrect, false);
  assert.equal(response.body.data.result.selectedSuspectName, 'Bram Cole');
  assert.equal(response.body.data.result.actualCulpritName, 'Ada Vale');
  assert.deepEqual(response.body.data.result.score, {
    total: 30, maximum: 100, accusationPoints: 0, evidencePoints: 30,
    reviewedEvidenceCount: 2, availableEvidenceCount: 2,
  });
  const saved = await Investigation.findById(investigation._id).select('+accusation +result');
  assert.equal(saved.status, 'Completed');
  assert.equal(saved.accusation.isCorrect, false);
  const persistedResult = await owner.get(`/api/investigations/${investigation._id}/result`);
  assert.equal(persistedResult.status, 200);
  assert.equal(persistedResult.body.data.result.finalExplanation, 'The access record and timeline establish Ada\'s opportunity.');
});
