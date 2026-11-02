import { z } from 'zod';

const isoDateTime = z.string().min(20).refine((value) => Number.isFinite(Date.parse(value)), 'Expected an ISO date and time.');
const nonEmpty = (max = 1600) => z.string().trim().min(1).max(max);

export const caseBlueprintSchema = z.object({
  case: z.object({
    title: nonEmpty(160),
    description: nonEmpty(900),
    incidentSummary: nonEmpty(1200),
    affectedPerson: nonEmpty(100),
    location: nonEmpty(200),
    incidentDateTime: isoDateTime,
    background: nonEmpty(900),
  }).strict(),
  incidentDetails: z.object({
    whatHappened: nonEmpty(1000),
    howItOccurred: nonEmpty(1000),
    possibleMotives: z.array(nonEmpty(240)).min(2).max(6),
  }).strict(),
  suspects: z.array(z.object({
    suspectId: nonEmpty(24),
    name: nonEmpty(100),
    age: z.number().int().min(18).max(100),
    occupation: nonEmpty(100),
    biography: nonEmpty(600),
    relationshipToIncident: nonEmpty(400),
    motive: nonEmpty(500),
    alibi: nonEmpty(500),
    background: nonEmpty(500),
  }).strict()).min(3).max(5),
  timeline: z.array(z.object({
    eventId: nonEmpty(24),
    occurredAt: isoDateTime,
    description: nonEmpty(500),
    suspectIds: z.array(nonEmpty(24)).max(5),
  }).strict()).min(4).max(12),
  clues: z.array(z.object({
    clueId: nonEmpty(24),
    description: nonEmpty(500),
    classification: z.enum(['supporting', 'contradictory', 'misleading', 'neutral']),
    explanation: nonEmpty(700),
    suspectIds: z.array(nonEmpty(24)).max(5),
  }).strict()).min(4).max(10),
  solution: z.object({
    culpritSuspectId: nonEmpty(24),
    crimeExplanation: nonEmpty(1200),
    actualSequenceOfEvents: z.array(nonEmpty(500)).min(3).max(10),
    supportingClueIds: z.array(nonEmpty(24)).min(2).max(8),
    misleadingClueExplanations: z.array(z.object({
      clueId: nonEmpty(24),
      explanation: nonEmpty(700),
    }).strict()).min(1).max(8),
    finalExplanation: nonEmpty(1800),
  }).strict(),
}).strict();

const chatMessageSchema = z.object({
  sender: nonEmpty(100),
  receiver: nonEmpty(100),
  text: nonEmpty(500),
  timestamp: isoDateTime,
}).strict();

export const evidencePlanSchema = z.object({
  evidence: z.array(z.object({
    evidenceId: nonEmpty(24),
    type: z.enum(['chat', 'image', 'cctv']),
    title: nonEmpty(160),
    description: nonEmpty(900),
    timestamp: isoDateTime,
    associatedSuspectIds: z.array(nonEmpty(24)).max(5),
    clueIds: z.array(nonEmpty(24)).min(1).max(6),
    reliability: z.enum(['supporting', 'contradictory', 'misleading', 'neutral']),
    internalPurpose: nonEmpty(700),
    conversationId: z.string().max(80),
    messages: z.array(chatMessageSchema).max(12),
    imagePrompt: z.string().max(1200),
    cameraLocation: z.string().max(200),
    durationSeconds: z.number().int().min(0).max(10),
    videoPrompt: z.string().max(1200),
  }).strict()).min(5).max(8),
}).strict();

export const caseBlueprintJsonSchema = {
  type: 'object',
  properties: {
    case: { type: 'object', properties: {
      title: { type: 'string' }, description: { type: 'string' }, incidentSummary: { type: 'string' },
      affectedPerson: { type: 'string' }, location: { type: 'string' }, incidentDateTime: { type: 'string' }, background: { type: 'string' },
    }, required: ['title', 'description', 'incidentSummary', 'affectedPerson', 'location', 'incidentDateTime', 'background'] },
    incidentDetails: { type: 'object', properties: {
      whatHappened: { type: 'string' }, howItOccurred: { type: 'string' }, possibleMotives: { type: 'array', items: { type: 'string' } },
    }, required: ['whatHappened', 'howItOccurred', 'possibleMotives'] },
    suspects: { type: 'array', items: { type: 'object', properties: {
      suspectId: { type: 'string' }, name: { type: 'string' }, age: { type: 'integer' }, occupation: { type: 'string' },
      biography: { type: 'string' }, relationshipToIncident: { type: 'string' }, motive: { type: 'string' }, alibi: { type: 'string' }, background: { type: 'string' },
    }, required: ['suspectId', 'name', 'age', 'occupation', 'biography', 'relationshipToIncident', 'motive', 'alibi', 'background'] } },
    timeline: { type: 'array', items: { type: 'object', properties: {
      eventId: { type: 'string' }, occurredAt: { type: 'string' }, description: { type: 'string' }, suspectIds: { type: 'array', items: { type: 'string' } },
    }, required: ['eventId', 'occurredAt', 'description', 'suspectIds'] } },
    clues: { type: 'array', items: { type: 'object', properties: {
      clueId: { type: 'string' }, description: { type: 'string' }, classification: { type: 'string', enum: ['supporting', 'contradictory', 'misleading', 'neutral'] },
      explanation: { type: 'string' }, suspectIds: { type: 'array', items: { type: 'string' } },
    }, required: ['clueId', 'description', 'classification', 'explanation', 'suspectIds'] } },
    solution: { type: 'object', properties: {
      culpritSuspectId: { type: 'string' }, crimeExplanation: { type: 'string' }, actualSequenceOfEvents: { type: 'array', items: { type: 'string' } },
      supportingClueIds: { type: 'array', items: { type: 'string' } },
      misleadingClueExplanations: { type: 'array', items: { type: 'object', properties: { clueId: { type: 'string' }, explanation: { type: 'string' } }, required: ['clueId', 'explanation'] } },
      finalExplanation: { type: 'string' },
    }, required: ['culpritSuspectId', 'crimeExplanation', 'actualSequenceOfEvents', 'supportingClueIds', 'misleadingClueExplanations', 'finalExplanation'] },
  },
  required: ['case', 'incidentDetails', 'suspects', 'timeline', 'clues', 'solution'],
};

export const evidencePlanJsonSchema = {
  type: 'object',
  properties: {
    evidence: { type: 'array', items: { type: 'object', properties: {
      evidenceId: { type: 'string' }, type: { type: 'string', enum: ['chat', 'image', 'cctv'] }, title: { type: 'string' },
      description: { type: 'string' }, timestamp: { type: 'string' }, associatedSuspectIds: { type: 'array', items: { type: 'string' } },
      clueIds: { type: 'array', items: { type: 'string' } }, reliability: { type: 'string', enum: ['supporting', 'contradictory', 'misleading', 'neutral'] },
      internalPurpose: { type: 'string' }, conversationId: { type: 'string' },
      messages: { type: 'array', items: { type: 'object', properties: { sender: { type: 'string' }, receiver: { type: 'string' }, text: { type: 'string' }, timestamp: { type: 'string' } }, required: ['sender', 'receiver', 'text', 'timestamp'] } },
      imagePrompt: { type: 'string' }, cameraLocation: { type: 'string' }, durationSeconds: { type: 'integer', minimum: 0, maximum: 10 }, videoPrompt: { type: 'string' },
    }, required: ['evidenceId', 'type', 'title', 'description', 'timestamp', 'associatedSuspectIds', 'clueIds', 'reliability', 'internalPurpose', 'conversationId', 'messages', 'imagePrompt', 'cameraLocation', 'durationSeconds', 'videoPrompt'] } },
  },
  required: ['evidence'],
};

export function validateBlueprintLogic(blueprint) {
  const suspectIds = new Set(blueprint.suspects.map((suspect) => suspect.suspectId));
  const clueIds = new Set(blueprint.clues.map((clue) => clue.clueId));

  if (suspectIds.size !== blueprint.suspects.length) throw new Error('Suspect IDs must be unique.');
  if (new Set(blueprint.timeline.map((event) => event.eventId)).size !== blueprint.timeline.length) throw new Error('Timeline event IDs must be unique.');
  if (clueIds.size !== blueprint.clues.length) throw new Error('Clue IDs must be unique.');
  if (!suspectIds.has(blueprint.solution.culpritSuspectId)) throw new Error('The culprit must match exactly one generated suspect.');
  if (!blueprint.clues.some((clue) => clue.classification === 'contradictory')) throw new Error('The case needs a meaningful contradiction clue.');
  if (!blueprint.clues.some((clue) => clue.classification === 'misleading')) throw new Error('The case needs an explainable misleading clue.');
  if (!blueprint.solution.supportingClueIds.every((id) => clueIds.has(id))) throw new Error('Solution support clues must reference generated clues.');
  if (!blueprint.solution.misleadingClueExplanations.every((entry) => (
    clueIds.has(entry.clueId) && blueprint.clues.some((clue) => clue.clueId === entry.clueId && clue.classification === 'misleading')
  ))) throw new Error('Every misleading clue needs a matching solution explanation.');
  if (blueprint.timeline.some((event) => event.suspectIds.some((id) => !suspectIds.has(id)))) throw new Error('Timeline events cannot reference unknown suspects.');
  if (blueprint.clues.some((clue) => clue.suspectIds.some((id) => !suspectIds.has(id)))) throw new Error('Clues cannot reference unknown suspects.');
  if (blueprint.timeline.some((event, index) => index > 0 && Date.parse(event.occurredAt) < Date.parse(blueprint.timeline[index - 1].occurredAt))) {
    throw new Error('Timeline events must be in chronological order.');
  }
  return blueprint;
}

export function normalizeEvidenceReliability(plan, blueprint) {
  const clues = new Map(blueprint.clues.map((clue) => [clue.clueId, clue]));
  return {
    ...plan,
    evidence: plan.evidence.map((item) => {
      if (item.reliability === 'neutral') return item;
      const linkedClassifications = item.clueIds
        .map((clueId) => clues.get(clueId)?.classification)
        .filter((classification) => classification && classification !== 'neutral');
      if (linkedClassifications.includes(item.reliability) || linkedClassifications.length === 0) return item;
      return { ...item, reliability: linkedClassifications[0] };
    }),
  };
}

export function validateEvidencePlanLogic(plan, blueprint) {
  const suspectIds = new Set(blueprint.suspects.map((suspect) => suspect.suspectId));
  const clues = new Map(blueprint.clues.map((clue) => [clue.clueId, clue]));
  const evidenceIds = plan.evidence.map((item) => item.evidenceId);
  const timeline = blueprint.timeline.map((event) => ({ ...event, time: Date.parse(event.occurredAt) }));
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error('Evidence IDs must be unique.');
  const count = (type) => plan.evidence.filter((item) => item.type === type).length;
  if (count('chat') < 2 || count('image') < 2 || count('cctv') < 1) throw new Error('Evidence must include at least two chats, two images, and one CCTV recording.');

  for (const item of plan.evidence) {
    if (/\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(item.title)) {
      throw new Error('Evidence titles must not repeat clock times; use the evidence timestamp metadata.');
    }
    if (item.associatedSuspectIds.some((id) => !suspectIds.has(id))) throw new Error('Evidence cannot reference unknown suspects.');
    if (item.clueIds.some((id) => !clues.has(id))) throw new Error('Evidence must reference clues from the case blueprint.');
    if (item.reliability !== 'neutral' && !item.clueIds.some((id) => clues.get(id).classification === item.reliability)) {
      throw new Error('Evidence reliability must match at least one linked clue.');
    }
    if (item.type === 'chat') {
      if (item.messages.length < 3 || item.messages.some((message, index) => index > 0 && Date.parse(message.timestamp) < Date.parse(item.messages[index - 1].timestamp))) {
        throw new Error('Chat evidence needs at least three chronological messages.');
      }
      const itemTime = Date.parse(item.timestamp);
      if (item.messages.some((message) => Math.abs(Date.parse(message.timestamp) - itemTime) > 24 * 60 * 60 * 1000)) {
        throw new Error('Chat evidence timestamps must stay within one day of their conversation messages.');
      }
    }
    if (item.type === 'image' && item.imagePrompt.trim().length < 20) throw new Error('Image evidence needs a specific generation prompt.');
    if (item.type === 'cctv' && (!item.videoPrompt.trim() || !item.cameraLocation.trim() || item.durationSeconds < 3)) {
      throw new Error('CCTV evidence needs a camera location, duration, and video prompt.');
    }
    if (item.type === 'cctv') {
      const itemTime = Date.parse(item.timestamp);
      const associatedSuspects = new Set(item.associatedSuspectIds);
      const relevantTimeline = timeline.filter((event) => (
        associatedSuspects.size === 0
        || event.suspectIds.length === 0
        || event.suspectIds.some((suspectId) => associatedSuspects.has(suspectId))
      ));
      const withinThirtyMinutes = relevantTimeline.some((event) => Math.abs(event.time - itemTime) <= 30 * 60 * 1000);
      if (!withinThirtyMinutes) {
        throw new Error('CCTV recording time must align within 30 minutes of a related event on the investigation timeline.');
      }
    }
  }

  for (const clue of blueprint.clues) {
    if (!plan.evidence.some((item) => item.clueIds.includes(clue.clueId))) throw new Error('Every clue must be represented in evidence.');
  }

  const supportEvidenceIds = plan.evidence
    .filter((item) => item.clueIds.some((clueId) => blueprint.solution.supportingClueIds.includes(clueId)))
    .map((item) => item.evidenceId);
  if (new Set(supportEvidenceIds).size < 2) throw new Error('At least two evidence items must support the solution.');

  const misleadingEvidenceExplanations = blueprint.solution.misleadingClueExplanations.flatMap((entry) => (
    plan.evidence.filter((item) => item.clueIds.includes(entry.clueId)).map((item) => ({
      evidenceId: item.evidenceId,
      explanation: entry.explanation,
    }))
  ));
  if (!misleadingEvidenceExplanations.length) throw new Error('Misleading evidence needs an explanation in the private solution.');

  return { supportingEvidenceIds: [...new Set(supportEvidenceIds)], misleadingEvidenceExplanations };
}
