import jwt from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'mystery_room_session';
export const AUTH_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return secret;
}

export function createSessionToken(userId) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    subject: userId,
    issuer: 'ai-mystery-room',
    audience: 'ai-mystery-room-client',
    expiresIn: '7d',
  });
}
