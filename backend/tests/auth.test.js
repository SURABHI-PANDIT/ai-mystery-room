import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { Investigation } from '../src/models/Investigation.js';
import { Evidence } from '../src/models/Evidence.js';
import { User } from '../src/models/User.js';

// Match the DNS resolver configured by the backend for MongoDB SRV lookups.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const email = `phase1-${randomUUID()}@example.test`;
const otherEmail = `phase1-other-${randomUUID()}@example.test`;
const password = 'Mystery-Room-Test-Password-42';
let userId;
let otherUserId;

before(async () => {
  await connectDatabase();
});

after(async () => {
  const userIds = [userId, otherUserId].filter(Boolean);
  if (userIds.length) {
    const investigationIds = await Investigation.find({ userId: { $in: userIds } }).distinct('_id');
    await Evidence.deleteMany({ investigationId: { $in: investigationIds } });
    await Investigation.deleteMany({ _id: { $in: investigationIds } });
  }
  await User.deleteMany({ email: { $in: [email, otherEmail] } });
  await mongoose.disconnect();
});

test('authentication lifecycle keeps credentials private and protects user history', async (t) => {
  const agent = request.agent(app);

  await t.test('registration validates input, hashes password and sets an HTTP-only cookie', async () => {
    const invalid = await request(app).post('/api/auth/register').send({ name: '', email: 'wrong', password: 'short' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const registered = await agent.post('/api/auth/register').send({ name: 'Test Investigator', email, password });
    assert.equal(registered.status, 201);
    assert.equal(registered.body.success, true);
    assert.equal(registered.body.data.user.email, email);
    assert.equal('password' in registered.body.data.user, false);
    assert.equal('passwordHash' in registered.body.data.user, false);

    const cookie = registered.headers['set-cookie']?.find((value) => value.startsWith('mystery_room_session='));
    assert.ok(cookie, 'registration should set the session cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const user = await User.findById(registered.body.data.user.id).select('+passwordHash');
    assert.ok(user.passwordHash);
    assert.notEqual(user.passwordHash, password);
    assert.equal(await bcrypt.compare(password, user.passwordHash), true);
    userId = user._id;
  });

  await t.test('duplicate email is rejected and a fresh request restores the cookie session', async () => {
    const duplicate = await request(app).post('/api/auth/register').send({ name: 'Another User', email, password });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_REGISTERED');

    const currentUser = await agent.get('/api/auth/me');
    assert.equal(currentUser.status, 200);
    assert.equal(currentUser.body.data.user.id, userId.toString());
    assert.equal('passwordHash' in currentUser.body.data.user, false);
  });

  await t.test('investigation history requires a session and is scoped to its owner', async () => {
    const anonymous = await request(app).get('/api/investigations');
    assert.equal(anonymous.status, 401);

    const otherUser = await User.create({
      name: 'Other Investigator',
      email: otherEmail,
      passwordHash: await bcrypt.hash(password, 12),
    });
    otherUserId = otherUser._id;
    const [myCase, anotherCase] = await Investigation.create([
      { userId, scenario: 'A private test scenario with enough detail for a case.', title: 'My private case', description: 'Owned by the test account', status: 'Ready', solution: { culpritSuspectId: 'S1', crimeExplanation: 'Private', actualSequenceOfEvents: [], supportingEvidenceIds: [], misleadingEvidenceExplanations: [], finalExplanation: 'Private' } },
      { userId: otherUserId, scenario: 'Another private test scenario with enough detail.', title: 'Another private case', description: 'Must stay private', status: 'Completed', solution: { culpritSuspectId: 'S2', crimeExplanation: 'Private', actualSequenceOfEvents: [], supportingEvidenceIds: [], misleadingEvidenceExplanations: [], finalExplanation: 'Private' } },
    ]);
    const otherEvidence = await Evidence.create({
      evidenceId: 'private-chat', investigationId: anotherCase._id, type: 'chat', title: 'Private message',
      description: 'Owned by the other account.', content: { conversationId: 'chat-1', messages: [] },
      clueIds: ['C1'], reliability: 'supporting', internalPurpose: 'Private test', associatedSuspectIds: [],
      timestamp: new Date(), displayOrder: 1, generationStatus: 'ready',
      media: [{ mediaId: 'private-media', mediaType: 'image', storageRef: 'private-media.png', mimeType: 'image/png', generationStatus: 'ready' }],
    });

    const history = await agent.get('/api/investigations');
    assert.equal(history.status, 200);
    assert.deepEqual(history.body.data.investigations.map((item) => item.title), ['My private case']);
    assert.equal('solution' in history.body.data.investigations[0], false);
    const overview = await agent.get(`/api/investigations/${myCase._id}`);
    assert.equal(overview.status, 200);
    assert.equal('solution' in overview.body.data.investigation, false);
    assert.equal('cluePlan' in overview.body.data.investigation, false);
    assert.equal('scenario' in overview.body.data.investigation, false);
    assert.equal('culpritSuspectId' in overview.body.data.investigation, false);
    assert.equal((await agent.get(`/api/investigations/${anotherCase._id}`)).status, 404);
    assert.equal((await agent.get(`/api/evidence/${otherEvidence._id}`)).status, 404);
    assert.equal((await agent.get('/api/media/private-media')).status, 404);
  });

  await t.test('login rejects invalid credentials, succeeds with valid credentials and logout clears access', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'incorrect-password' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');

    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
    await agent.get('/api/investigations').expect(401);

    const login = await agent.post('/api/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    assert.ok(login.headers['set-cookie']?.some((value) => value.startsWith('mystery_room_session=')));
    const currentUser = await agent.get('/api/auth/me');
    assert.equal(currentUser.status, 200);

    const logout = await agent.post('/api/auth/logout');
    assert.equal(logout.status, 200);
    assert.ok(logout.headers['set-cookie']?.some((value) => (
      /^mystery_room_session=;/i.test(value) && /Expires=/i.test(value)
    )));
    await agent.get('/api/auth/me').expect(401);
  });
});
