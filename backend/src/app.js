import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import authRouter from './routes/auth.js';
import evidenceRouter from './routes/evidence.js';
import healthRouter from './routes/health.js';
import investigationsRouter from './routes/investigations.js';
import mediaRouter from './routes/media.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp({ investigations = investigationsRouter } = {}) {
  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/investigations', investigations);
  app.use('/api/evidence', evidenceRouter);
  app.use('/api/media', mediaRouter);

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      message: 'Route not found.',
      error: { code: 'NOT_FOUND' },
    });
  });

  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
