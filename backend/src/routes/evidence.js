import { Router } from 'express';
import { Evidence } from '../models/Evidence.js';
import { Investigation } from '../models/Investigation.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

function failure(response, status, code, message) {
  return response.status(status).json({ success: false, message, error: { code } });
}

function publicEvidence(evidence) {
  return {
    id: evidence._id.toString(),
    evidenceId: evidence.evidenceId,
    type: evidence.type,
    title: evidence.title,
    description: evidence.description,
    content: evidence.content,
    associatedSuspectIds: evidence.associatedSuspectIds,
    timestamp: evidence.timestamp,
    displayOrder: evidence.displayOrder,
    generationStatus: evidence.generationStatus,
    generationMessage: evidence.generationMessage,
    media: (evidence.media || []).map((item) => ({
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      generationStatus: item.generationStatus,
      message: item.message,
      url: item.generationStatus === 'ready' ? `/api/media/${encodeURIComponent(item.mediaId)}` : undefined,
    })),
  };
}

router.get('/:id', requireAuth, async (request, response, next) => {
  try {
    const evidence = await Evidence.findById(request.params.id).lean();
    if (!evidence) return failure(response, 404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
    const owner = await Investigation.exists({ _id: evidence.investigationId, userId: request.user._id });
    if (!owner) return failure(response, 404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
    return response.json({
      success: true,
      message: 'Evidence loaded.',
      data: { evidence: publicEvidence(evidence) },
    });
  } catch (error) {
    if (error.name === 'CastError') return failure(response, 404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
    return next(error);
  }
});

export default router;
