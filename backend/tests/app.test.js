import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

test('Render trusts exactly one reverse-proxy hop and resolves the forwarded client IP', async () => {
  const investigations = express.Router();
  investigations.get('/proxy-check', (req, res) => res.json({ ip: req.ip }));
  const app = createApp({ investigations });

  assert.equal(app.get('trust proxy'), 1);
  const response = await request(app)
    .get('/api/investigations/proxy-check')
    .set('X-Forwarded-For', '203.0.113.42');

  assert.equal(response.status, 200);
  assert.equal(response.body.ip, '203.0.113.42');
});
