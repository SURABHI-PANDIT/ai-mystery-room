import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AUTH_COOKIE_NAME, getJwtSecret } from '../utils/auth.js';

export async function requireAuth(request, response, next) {
  const token = request.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return response.status(401).json({
      success: false,
      message: 'Please sign in to continue.',
      error: { code: 'UNAUTHORIZED' },
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: 'ai-mystery-room',
      audience: 'ai-mystery-room-client',
    });
    const user = await User.findById(payload.sub);

    if (!user) {
      response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
      return response.status(401).json({
        success: false,
        message: 'Your session is no longer valid. Please sign in again.',
        error: { code: 'UNAUTHORIZED' },
      });
    }

    request.user = user;
    return next();
  } catch {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
    return response.status(401).json({
      success: false,
      message: 'Your session is invalid or has expired. Please sign in again.',
      error: { code: 'UNAUTHORIZED' },
    });
  }
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
