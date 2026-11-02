import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { User, toPublicUser } from '../models/User.js';
import { requireAuth, authCookieOptions } from '../middleware/requireAuth.js';
import { AUTH_COOKIE_NAME, AUTH_SESSION_MS, createSessionToken } from '../utils/auth.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please try again in a few minutes.',
    error: { code: 'AUTH_RATE_LIMITED' },
  },
});

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

function validationFailure(response, details) {
  return response.status(400).json({
    success: false,
    message: 'Please check the information and try again.',
    error: {
      code: 'VALIDATION_ERROR',
      fields: details.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    },
  });
}

function setSessionCookie(response, userId) {
  const token = createSessionToken(userId);
  response.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: AUTH_SESSION_MS,
  });
}

router.post('/register', authLimiter, async (request, response, next) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) return validationFailure(response, parsed.error.issues);

  try {
    const { name, email, password } = parsed.data;
    const existing = await User.exists({ email });
    if (existing) {
      return response.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        error: { code: 'EMAIL_ALREADY_REGISTERED' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setSessionCookie(response, user._id.toString());
    return response.status(201).json({
      success: true,
      message: 'Your account is ready.',
      data: { user: toPublicUser(user) },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authLimiter, async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) return validationFailure(response, parsed.error.issues);

  try {
    const { email, password } = parsed.data;
    const user = await User.findOne({ email }).select('+passwordHash');
    const validPassword = user && await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return response.status(401).json({
        success: false,
        message: 'Email or password is incorrect.',
        error: { code: 'INVALID_CREDENTIALS' },
      });
    }

    setSessionCookie(response, user._id.toString());
    return response.json({
      success: true,
      message: 'You are signed in.',
      data: { user: toPublicUser(user) },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_request, response) => {
  response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  return response.json({ success: true, message: 'You are signed out.', data: {} });
});

router.get('/me', requireAuth, (request, response) => {
  return response.json({
    success: true,
    message: 'Current user loaded.',
    data: { user: toPublicUser(request.user) },
  });
});

export default router;
