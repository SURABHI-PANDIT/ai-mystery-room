import { Evidence } from '../../models/Evidence.js';
import { Investigation } from '../../models/Investigation.js';
import { buildCaseBlueprintPrompt, buildEvidencePlanPrompt, caseBlueprintInstructions, evidencePlanInstructions } from '../../prompts/investigationPrompts.js';
import { getGeminiClient } from '../ai/geminiClient.js';
import {
  caseBlueprintJsonSchema,
  caseBlueprintSchema,
  evidencePlanJsonSchema,
  evidencePlanSchema,
  normalizeEvidenceReliability,
  validateBlueprintLogic,
  validateEvidencePlanLogic,
} from '../ai/schemas.js';
import { generateStructuredOutput } from '../ai/structuredGeneration.js';
import { generateGeminiImage } from '../media/geminiImageAdapter.js';
import { generateGeminiVideo } from '../media/geminiVideoAdapter.js';
import { deleteMedia, storeMedia } from '../media/localStorage.js';

const maxAttempts = () => Math.max(1, Math.min(3, Number(process.env.GEMINI_MAX_ATTEMPTS) || 3));

function userFacingFailure(error) {
  if (error.code === 'GEMINI_NOT_CONFIGURED') return 'Case generation is not configured yet. Please contact the administrator.';
  if (error.code === 'INVALID_AI_OUTPUT') return 'The generated case did not pass consistency checks. You can retry this case.';
  if (error.code === 'GEMINI_DAILY_QUOTA_EXHAUSTED') return 'Gemini’s daily request quota is exhausted. Retry when the quota becomes available.';
  if (error.code === 'GEMINI_RATE_LIMITED') return 'Gemini has reached a temporary request or quota limit. Please wait a little, then retry.';
  if (error.code === 'GEMINI_OVERLOADED') return 'Gemini is busy right now. Please wait a moment, then retry.';
  if (error.code === 'GEMINI_TIMEOUT') return 'Gemini did not respond in time. Your scenario is saved; please retry shortly.';
  if (error.code === 'GEMINI_AUTH_FAILED' || error.code === 'GEMINI_MODEL_UNAVAILABLE') return 'Gemini is not currently available with the server configuration. Please contact the administrator.';
  return 'Case generation could not finish. Please retry in a moment.';
}

async function setProgress(investigationId, stage, percent, message) {
  await Investigation.updateOne({ _id: investigationId }, {
    $set: { generationProgress: { stage, percent, message } },
  });
}

function evidenceContent(item) {
  if (item.type === 'chat') {
    return { conversationId: item.conversationId, messages: item.messages };
  }
  if (item.type === 'image') return { caption: item.description };
  return {
    cameraLocation: item.cameraLocation,
    recordedAt: item.timestamp,
    durationSeconds: item.durationSeconds,
    visualSummary: item.description,
  };
}

function privateSolution(blueprint, evidencePlan, links) {
  return {
    culpritSuspectId: blueprint.solution.culpritSuspectId,
    crimeExplanation: blueprint.solution.crimeExplanation,
    actualSequenceOfEvents: blueprint.solution.actualSequenceOfEvents,
    supportingClueIds: blueprint.solution.supportingClueIds,
    supportingEvidenceIds: links.supportingEvidenceIds,
    misleadingEvidenceExplanations: links.misleadingEvidenceExplanations,
    finalExplanation: blueprint.solution.finalExplanation,
  };
}

async function generateAndSaveMedia(evidence, item, ai, providers) {
  const video = item.type === 'cctv';
  const mediaType = video ? 'video' : 'image';
  let stored;

  try {
    const generated = video
      ? await providers.generateVideo(item.videoPrompt, { ai })
      : await providers.generateImage(item.imagePrompt, { ai });
    stored = await providers.storeMedia(generated.buffer, generated.mimeType);
    await Evidence.updateOne({ _id: evidence._id }, {
      $set: {
        generationStatus: 'ready',
        generationMessage: '',
        media: [{
          ...stored,
          mediaType,
          generationStatus: 'ready',
          message: '',
        }],
      },
    });
  } catch (error) {
    if (stored?.storageRef) {
      await deleteMedia(stored.storageRef).catch(() => {});
    }
    const unavailable = error.code === 'MEDIA_UNAVAILABLE' || !process.env[video ? 'GEMINI_VIDEO_MODEL' : 'GEMINI_IMAGE_MODEL'];
    const status = Number(error.status || error.statusCode || error.response?.status) || undefined;
    const quotaDisabled = status === 429 && /limit:\s*0\b/i.test(error.message || '');
    const timeout = /timeout|timed out|aborted/i.test(`${error.name || ''} ${error.message || ''}`);
    const mediaLabel = video ? 'Video' : 'Image';
    const message = quotaDisabled
      ? `${mediaLabel} generation is unavailable on the current Gemini API plan; no media was created.`
      : unavailable
      ? `${mediaLabel} generation is unavailable; no media was created.`
      : status === 429
        ? `${mediaLabel} generation hit a temporary request or quota limit; the case is still playable.`
        : status === 503
          ? `${mediaLabel} generation is busy right now; the case is still playable.`
          : timeout
            ? `${mediaLabel} generation timed out; the case is still playable.`
            : `${mediaLabel} generation failed; the case is still playable.`;
    const key = process.env.GEMINI_API_KEY;
    const diagnostic = String(error.message || 'Media provider request failed.')
      .replaceAll(key || '\u0000', '[REDACTED]')
      .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .slice(0, 600);
    console.error(JSON.stringify({
      event: 'investigation_media_generation_failed',
      investigationId: String(evidence.investigationId),
      evidenceId: item.evidenceId,
      mediaType,
      code: quotaDisabled ? 'MEDIA_QUOTA_UNAVAILABLE' : error.code || 'MEDIA_GENERATION_FAILED',
      providerStatus: status,
      providerErrorName: error.name || 'Error',
      diagnostic,
    }));
    await Evidence.updateOne({ _id: evidence._id }, {
      $set: {
        generationStatus: unavailable || quotaDisabled ? 'unavailable' : 'failed',
        generationMessage: message,
        media: [],
      },
    });
  }
}

export async function runInvestigationGeneration(investigationId, options = {}) {
  const aiOverride = options.ai;
  const providers = options.providers || {
    generateImage: generateGeminiImage,
    generateVideo: generateGeminiVideo,
    storeMedia,
  };
  let stage = 'loading-investigation';

  try {
    const investigation = await Investigation.findById(investigationId).select('+scenario');
    if (!investigation || investigation.status !== 'Generating') return;

    stage = 'drafting-case';
    await setProgress(investigationId, stage, 10, 'Asking Gemini to draft and validate the case.');
    const ai = aiOverride || getGeminiClient();
    const blueprint = await generateStructuredOutput({
      ai,
      model: process.env.GEMINI_TEXT_MODEL,
      systemInstruction: caseBlueprintInstructions,
      promptBuilder: (correction) => buildCaseBlueprintPrompt(investigation.scenario, correction),
      jsonSchema: caseBlueprintJsonSchema,
      zodSchema: caseBlueprintSchema,
      semanticValidator: validateBlueprintLogic,
      timeoutMs: Number(process.env.GEMINI_TEXT_TIMEOUT_MS) || 60_000,
      maxAttempts: maxAttempts(),
    });

    stage = 'planning-evidence';
    await setProgress(investigationId, 'planning-evidence', 35, 'Case outline validated. Connecting clues and evidence.');
    const plan = await generateStructuredOutput({
      ai,
      model: process.env.GEMINI_TEXT_MODEL,
      systemInstruction: evidencePlanInstructions,
      promptBuilder: (correction) => buildEvidencePlanPrompt(blueprint, correction),
      jsonSchema: evidencePlanJsonSchema,
      zodSchema: evidencePlanSchema,
      semanticValidator: (candidate) => {
        const normalizedPlan = normalizeEvidenceReliability(candidate, blueprint);
        return {
          plan: normalizedPlan,
          links: validateEvidencePlanLogic(normalizedPlan, blueprint),
        };
      },
      timeoutMs: Number(process.env.GEMINI_TEXT_TIMEOUT_MS) || 60_000,
      maxAttempts: maxAttempts(),
    });

    const validatedPlan = plan.plan;
    const links = plan.links;
    const evidenceRows = validatedPlan.evidence.map((item, index) => ({
      evidenceId: item.evidenceId,
      investigationId,
      type: item.type,
      title: item.title,
      description: item.description,
      content: evidenceContent(item),
      clueIds: item.clueIds,
      reliability: item.reliability,
      internalPurpose: item.internalPurpose,
      associatedSuspectIds: item.associatedSuspectIds,
      timestamp: item.timestamp,
      displayOrder: index + 1,
      generationStatus: item.type === 'chat' ? 'ready' : 'pending',
      generationMessage: '',
    }));

    stage = 'saving-case';
    await setProgress(investigationId, 'saving-case', 55, 'Saving the case file and evidence records.');
    await Evidence.deleteMany({ investigationId });
    await Evidence.insertMany(evidenceRows);
    await Investigation.updateOne({ _id: investigationId }, {
      $set: {
        title: blueprint.case.title,
        description: blueprint.case.description,
        incidentSummary: blueprint.case.incidentSummary,
        caseInfo: {
          location: blueprint.case.location,
          incidentDateTime: blueprint.case.incidentDateTime,
          background: blueprint.case.background,
        },
        incidentDetails: blueprint.incidentDetails,
        suspects: blueprint.suspects,
        timeline: blueprint.timeline.map((event) => ({ ...event, occurredAt: new Date(event.occurredAt) })),
        cluePlan: blueprint.clues,
        solution: privateSolution(blueprint, validatedPlan, links),
      },
    });

    stage = 'generating-media';
    await setProgress(investigationId, 'generating-media', 65, 'Generating investigation images and CCTV video.');
    const mediaItems = validatedPlan.evidence.filter((item) => item.type === 'image' || item.type === 'cctv');
    for (let index = 0; index < mediaItems.length; index += 1) {
      const item = mediaItems[index];
      const evidence = await Evidence.findOne({ investigationId, evidenceId: item.evidenceId });
      await generateAndSaveMedia(evidence, item, ai, providers);
      const percent = 65 + Math.round(((index + 1) / mediaItems.length) * 30);
      await setProgress(investigationId, 'generating-media', percent, 'Generating investigation images and CCTV video.');
    }

    await Investigation.updateOne({ _id: investigationId }, {
      $set: {
        status: 'Ready',
        generationProgress: { stage: 'complete', percent: 100, message: 'Your investigation is ready.' },
      },
      $unset: { generationError: 1 },
    });
  } catch (error) {
    const code = error.code || 'GENERATION_FAILED';
    const diagnostic = error.diagnostic?.diagnostic
      || (error.code === 'INVALID_AI_OUTPUT' ? 'Generated JSON failed schema or consistency validation.' : 'Unexpected worker failure; see the safe error code and stage.');
    const failureDetails = error.diagnostic || {};
    console.error(JSON.stringify({
      event: 'investigation_generation_failed',
      investigationId: String(investigationId),
      stage,
      code,
      providerStatus: failureDetails.status,
      providerErrorName: error.cause?.name,
      providerErrorCode: error.cause?.code,
      diagnostic,
    }));
    await Investigation.updateOne({ _id: investigationId }, {
      $set: {
        status: 'Failed',
        generationProgress: { stage: 'failed', percent: 100, message: userFacingFailure(error) },
        generationError: {
          code,
          detail: diagnostic,
          message: userFacingFailure(error),
          ...(failureDetails.retryAvailableAt ? { retryAvailableAt: failureDetails.retryAvailableAt } : {}),
        },
      },
    });
  }
}

export function queueInvestigationGeneration(investigationId) {
  setImmediate(() => {
    runInvestigationGeneration(investigationId).catch((error) => {
      console.error(JSON.stringify({
        event: 'investigation_worker_crashed',
        investigationId: String(investigationId),
        code: error?.code || 'GENERATION_FAILED',
        errorName: error?.name || 'Error',
      }));
      Investigation.updateOne({ _id: investigationId }, {
        $set: {
          status: 'Failed',
          generationProgress: { stage: 'failed', percent: 100, message: 'Case generation could not finish. Please retry in a moment.' },
          generationError: { code: error?.code || 'GENERATION_FAILED', detail: 'unexpected worker error', message: 'Case generation could not finish. Please retry in a moment.' },
        },
      }).catch(() => {});
    });
  });
}
