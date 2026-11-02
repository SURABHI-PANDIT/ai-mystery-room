import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Evidence } from '../models/Evidence.js';
import { Investigation } from '../models/Investigation.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { queueInvestigationGeneration } from '../services/investigation/generationService.js';
import { deleteMedia } from '../services/media/localStorage.js';

const failure = (response, status, code, message) => response.status(status).json({
  success: false,
  message,
  error: { code },
});

function scenarioLimit() {
  return Math.max(100, Math.min(4000, Number(process.env.SCENARIO_MAX_LENGTH) || 2000));
}

function investigationOverview(investigation) {
  return {
    id: investigation._id.toString(),
    title: investigation.title,
    description: investigation.description,
    incidentSummary: investigation.incidentSummary,
    caseInfo: investigation.caseInfo,
    incidentDetails: investigation.incidentDetails,
    suspects: investigation.suspects,
    timeline: investigation.timeline,
    status: investigation.status,
    generationProgress: investigation.generationProgress,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
  };
}

async function removeInvestigationMedia(investigationId) {
  const evidenceRecords = await Evidence.find({ investigationId }).select('+media.storageRef').lean();
  await Promise.all(evidenceRecords.flatMap((evidence) => (
    (evidence.media || [])
      .filter((media) => media.generationStatus === 'ready' && media.storageRef)
      .map((media) => deleteMedia(media.storageRef).catch(() => {}))
  )));
  await Evidence.deleteMany({ investigationId });
}

export function createInvestigationsRouter({ scheduleGeneration = queueInvestigationGeneration } = {}) {
  const router = Router();
  const generationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many case-generation requests. Please try again later.',
      error: { code: 'GENERATION_RATE_LIMITED' },
    },
  });
  router.use(requireAuth);

  router.get('/', async (request, response, next) => {
    try {
      const investigations = await Investigation.find({ userId: request.user._id })
        .select('title description status generationProgress createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean();

      return response.json({
        success: true,
        message: 'Investigation history loaded.',
        data: {
          investigations: investigations.map((investigation) => ({
            id: investigation._id.toString(),
            title: investigation.title,
            description: investigation.description,
            status: investigation.status,
            generationProgress: investigation.generationProgress,
            createdAt: investigation.createdAt,
            updatedAt: investigation.updatedAt,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', generationLimiter, async (request, response, next) => {
    const maxLength = scenarioLimit();
    const inputSchema = z.object({ scenario: z.string().trim().min(20).max(maxLength) }).strict();
    const parsed = inputSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Enter a mystery scenario to continue.',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    try {
      const investigation = await Investigation.create({
        userId: request.user._id,
        scenario: parsed.data.scenario,
        title: 'Generating case…',
        description: 'A new investigation is being prepared.',
        status: 'Generating',
        generationProgress: { stage: 'queued', percent: 0, message: 'Your case is in the queue.' },
      });
      scheduleGeneration(investigation._id.toString());
      return response.status(202).json({
        success: true,
        message: 'Case generation has started.',
        data: {
          investigation: {
            id: investigation._id.toString(),
            status: investigation.status,
            generationProgress: investigation.generationProgress,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:id/status', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id })
        .select('status generationProgress +generationError.message +generationError.retryAvailableAt')
        .lean();
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return response.json({
        success: true,
        message: 'Generation status loaded.',
        data: {
          status: investigation.status,
          progress: investigation.generationProgress,
          error: investigation.status === 'Failed' ? investigation.generationError?.message : undefined,
          retryAvailableAt: investigation.status === 'Failed' && investigation.generationError?.retryAvailableAt
            ? new Date(investigation.generationError.retryAvailableAt).toISOString()
            : undefined,
        },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.get('/:id/evidence', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id }).select('_id status');
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      if (!['Ready', 'In Progress', 'Completed'].includes(investigation.status)) {
        return failure(response, 409, 'INVESTIGATION_NOT_READY', 'Evidence is not ready yet.');
      }
      const evidence = await Evidence.find({ investigationId: investigation._id })
        .sort({ displayOrder: 1 })
        .lean();
      return response.json({
        success: true,
        message: 'Evidence loaded.',
        data: { evidence: evidence.map(publicEvidence) },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.post('/:id/retry', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id, status: 'Failed' })
        .select('+scenario +generationError.retryAvailableAt +generationError.message');
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'A failed investigation was not found.');
      const retryAvailableAt = investigation.generationError?.retryAvailableAt;
      if (retryAvailableAt && retryAvailableAt.getTime() > Date.now()) {
        return response.status(429).json({
          success: false,
          message: investigation.generationError?.message || 'Retry is not available yet.',
          error: { code: 'RETRY_NOT_AVAILABLE' },
          data: { retryAvailableAt: retryAvailableAt.toISOString() },
        });
      }
      await removeInvestigationMedia(investigation._id);
      await Investigation.updateOne({ _id: investigation._id }, {
        $set: {
          status: 'Generating',
          title: 'Generating case…',
          description: 'A new investigation is being prepared.',
          incidentSummary: '',
          caseInfo: { location: '', incidentDateTime: null, background: '' },
          incidentDetails: { whatHappened: '', howItOccurred: '', possibleMotives: [] },
          suspects: [],
          timeline: [],
          reviewedEvidenceIds: [],
          generationProgress: { stage: 'queued', percent: 0, message: 'Your case is back in the queue.' },
        },
        $unset: { solution: 1, cluePlan: 1, generationError: 1, accusation: 1, result: 1 },
      });
      scheduleGeneration(investigation._id.toString());
      return response.status(202).json({
        success: true,
        message: 'Case generation has restarted.',
        data: { investigation: { id: investigation._id.toString(), status: 'Generating' } },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.get('/:id', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id })
        .select('-scenario -solution -cluePlan -generationError')
        .lean();
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      if (investigation.status !== 'Ready' && investigation.status !== 'In Progress' && investigation.status !== 'Completed') {
        return failure(response, 409, 'INVESTIGATION_NOT_READY', 'The investigation details are not ready yet.');
      }
      return response.json({
        success: true,
        message: 'Investigation loaded.',
        data: { investigation: investigationOverview(investigation) },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.post('/:id/evidence/:evidenceId/viewed', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({
        _id: request.params.id,
        userId: request.user._id,
        status: { $in: ['Ready', 'In Progress'] },
      }).select('_id');
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'An active investigation was not found.');

      const evidence = await Evidence.findOne({ investigationId: investigation._id, evidenceId: request.params.evidenceId }).select('_id evidenceId');
      if (!evidence) return failure(response, 404, 'EVIDENCE_NOT_FOUND', 'Evidence was not found in this investigation.');

      const updated = await Investigation.findOneAndUpdate({
        _id: investigation._id,
        status: { $in: ['Ready', 'In Progress'] },
      }, {
        $addToSet: { reviewedEvidenceIds: evidence.evidenceId },
        $set: { status: 'In Progress' },
      }, { new: true }).select('reviewedEvidenceIds');
      if (!updated) return failure(response, 409, 'INVESTIGATION_COMPLETED', 'This investigation is already complete.');
      return response.json({
        success: true,
        message: 'Evidence marked as reviewed.',
        data: { reviewedEvidenceIds: updated.reviewedEvidenceIds },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.post('/:id/accuse', async (request, response, next) => {
    const input = z.object({ selectedSuspectId: z.string().trim().min(1).max(80) }).strict().safeParse(request.body);
    if (!input.success) return failure(response, 400, 'VALIDATION_ERROR', 'Select one suspect before submitting your final accusation.');

    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id })
        .select('+solution +cluePlan +reviewedEvidenceIds +accusation');
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      if (investigation.status === 'Completed' || investigation.accusation?.submittedAt) {
        return failure(response, 409, 'ACCUSATION_ALREADY_SUBMITTED', 'A final accusation has already been submitted for this case.');
      }
      if (!['Ready', 'In Progress'].includes(investigation.status)) {
        return failure(response, 409, 'INVESTIGATION_NOT_READY', 'This investigation is not ready for an accusation.');
      }
      const selectedSuspect = investigation.suspects.find((suspect) => suspect.suspectId === input.data.selectedSuspectId);
      if (!selectedSuspect) return failure(response, 400, 'INVALID_SUSPECT', 'Choose a suspect from this investigation.');
      if (!investigation.solution?.culpritSuspectId) return failure(response, 409, 'SOLUTION_UNAVAILABLE', 'The case solution is not available yet.');

      const culprit = investigation.suspects.find((suspect) => suspect.suspectId === investigation.solution.culpritSuspectId);
      if (!culprit) return failure(response, 409, 'SOLUTION_INVALID', 'The stored case solution could not be verified.');
      const allEvidence = await Evidence.find({ investigationId: investigation._id })
        .select('evidenceId title description +internalPurpose')
        .lean();
      const availableEvidenceIds = new Set(allEvidence.map((item) => item.evidenceId));
      const reviewedEvidenceCount = new Set((investigation.reviewedEvidenceIds || [])
        .filter((evidenceId) => availableEvidenceIds.has(evidenceId))).size;
      const availableEvidenceCount = allEvidence.length;
      const isCorrect = input.data.selectedSuspectId === investigation.solution.culpritSuspectId;
      const accusationPoints = isCorrect ? 70 : 0;
      const evidencePoints = availableEvidenceCount
        ? Math.round((reviewedEvidenceCount / availableEvidenceCount) * 30)
        : 0;
      const completedAt = new Date();
      const evidenceById = new Map(allEvidence.map((item) => [item.evidenceId, item]));
      const supportingClueIds = new Set(investigation.solution.supportingClueIds || []);
      const supportingClues = investigation.cluePlan
        .filter((clue) => supportingClueIds.has(clue.clueId))
        .map(({ clueId, description, explanation }) => ({ clueId, description, explanation }));
      const supportingEvidence = investigation.solution.supportingEvidenceIds
        .map((evidenceId) => evidenceById.get(evidenceId))
        .filter(Boolean)
        .map((item) => ({
          evidenceId: item.evidenceId,
          title: item.title,
          description: item.description,
          explanation: item.internalPurpose,
        }));
      const misleadingEvidenceExplanations = investigation.solution.misleadingEvidenceExplanations
        .map((entry) => ({ ...entry, evidence: evidenceById.get(entry.evidenceId) }))
        .filter((entry) => entry.evidence)
        .map(({ evidenceId, explanation, evidence }) => ({
          evidenceId,
          title: evidence.title,
          description: evidence.description,
          explanation,
        }));
      const accusation = {
        selectedSuspectId: selectedSuspect.suspectId,
        submittedAt: completedAt,
        isCorrect,
      };
      const result = {
        selectedSuspectId: selectedSuspect.suspectId,
        selectedSuspectName: selectedSuspect.name,
        actualCulpritSuspectId: culprit.suspectId,
        actualCulpritName: culprit.name,
        isCorrect,
        score: {
          total: accusationPoints + evidencePoints,
          maximum: 100,
          accusationPoints,
          evidencePoints,
          reviewedEvidenceCount,
          availableEvidenceCount,
        },
        crimeExplanation: investigation.solution.crimeExplanation,
        finalExplanation: investigation.solution.finalExplanation,
        actualSequenceOfEvents: investigation.solution.actualSequenceOfEvents,
        supportingClues,
        supportingEvidence,
        misleadingEvidenceExplanations,
        timeline: investigation.timeline,
        completedAt,
      };

      const saved = await Investigation.updateOne({
        _id: investigation._id,
        userId: request.user._id,
        status: { $in: ['Ready', 'In Progress'] },
        'accusation.submittedAt': { $exists: false },
      }, {
        $set: { accusation, result, status: 'Completed' },
      });
      if (saved.modifiedCount !== 1) {
        return failure(response, 409, 'ACCUSATION_ALREADY_SUBMITTED', 'A final accusation has already been submitted for this case.');
      }

      return response.status(201).json({
        success: true,
        message: 'Accusation submitted. The case solution is now revealed.',
        data: { result: publicResult(result) },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  router.get('/:id/result', async (request, response, next) => {
    try {
      const investigation = await Investigation.findOne({ _id: request.params.id, userId: request.user._id })
        .select('+result +accusation');
      if (!investigation) return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      if (investigation.status !== 'Completed' || !investigation.accusation?.submittedAt || !investigation.result) {
        return failure(response, 409, 'RESULT_NOT_AVAILABLE', 'Submit a final accusation to reveal the case result.');
      }
      return response.json({
        success: true,
        message: 'Investigation result loaded.',
        data: { result: publicResult(investigation.result) },
      });
    } catch (error) {
      if (error.name === 'CastError') return failure(response, 404, 'INVESTIGATION_NOT_FOUND', 'Investigation not found.');
      return next(error);
    }
  });

  return router;
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

function publicResult(result) {
  return {
    selectedSuspectId: result.selectedSuspectId,
    selectedSuspectName: result.selectedSuspectName,
    actualCulpritSuspectId: result.actualCulpritSuspectId,
    actualCulpritName: result.actualCulpritName,
    isCorrect: result.isCorrect,
    score: result.score,
    crimeExplanation: result.crimeExplanation,
    finalExplanation: result.finalExplanation,
    actualSequenceOfEvents: result.actualSequenceOfEvents,
    supportingClues: result.supportingClues,
    supportingEvidence: result.supportingEvidence,
    misleadingEvidenceExplanations: result.misleadingEvidenceExplanations,
    timeline: result.timeline,
    completedAt: result.completedAt,
  };
}

export default createInvestigationsRouter();
