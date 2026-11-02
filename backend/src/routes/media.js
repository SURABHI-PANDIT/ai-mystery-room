import { Router } from 'express';
import { Evidence } from '../models/Evidence.js';
import { Investigation } from '../models/Investigation.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { readMedia } from '../services/media/localStorage.js';

const router = Router();

router.get('/:mediaId', requireAuth, async (request, response, next) => {
  try {
    const evidence = await Evidence.findOne({
      'media.mediaId': request.params.mediaId,
      'media.generationStatus': 'ready',
    }).select('+media.storageRef');
    if (!evidence) return response.status(404).json({ success: false, message: 'Media not found.', error: { code: 'MEDIA_NOT_FOUND' } });

    const owned = await Investigation.exists({ _id: evidence.investigationId, userId: request.user._id });
    if (!owned) return response.status(404).json({ success: false, message: 'Media not found.', error: { code: 'MEDIA_NOT_FOUND' } });

    const media = evidence.media.find((item) => item.mediaId === request.params.mediaId && item.generationStatus === 'ready');
    if (!media?.storageRef) return response.status(404).json({ success: false, message: 'Media not found.', error: { code: 'MEDIA_NOT_FOUND' } });

    const file = await readMedia(media.storageRef);
    response.set({
      'Content-Type': media.mimeType,
      'Content-Length': file.length,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return response.send(file);
  } catch (error) {
    if (error.name === 'CastError') return response.status(404).json({ success: false, message: 'Media not found.', error: { code: 'MEDIA_NOT_FOUND' } });
    return next(error);
  }
});

export default router;
