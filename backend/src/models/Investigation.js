import mongoose from 'mongoose';

const suspectSchema = new mongoose.Schema({
  suspectId: { type: String, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  occupation: { type: String, required: true },
  biography: { type: String, required: true },
  relationshipToIncident: { type: String, required: true },
  motive: { type: String, required: true },
  alibi: { type: String, required: true },
  background: { type: String, required: true },
}, { _id: false });

const timelineEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  description: { type: String, required: true },
  suspectIds: { type: [String], default: [] },
}, { _id: false });

const clueSchema = new mongoose.Schema({
  clueId: { type: String, required: true },
  description: { type: String, required: true },
  classification: {
    type: String,
    enum: ['supporting', 'contradictory', 'misleading', 'neutral'],
    required: true,
  },
  explanation: { type: String, required: true },
  suspectIds: { type: [String], default: [] },
}, { _id: false });

const privateSolutionSchema = new mongoose.Schema({
  culpritSuspectId: { type: String, required: true },
  crimeExplanation: { type: String, required: true },
  actualSequenceOfEvents: { type: [String], required: true },
  supportingClueIds: { type: [String], default: [] },
  supportingEvidenceIds: { type: [String], required: true },
  misleadingEvidenceExplanations: [{
    evidenceId: { type: String, required: true },
    explanation: { type: String, required: true },
  }],
  finalExplanation: { type: String, required: true },
}, { _id: false });

const accusationSchema = new mongoose.Schema({
  selectedSuspectId: { type: String, required: true },
  submittedAt: { type: Date, required: true },
  isCorrect: { type: Boolean, required: true },
}, { _id: false });

const resultEvidenceSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  explanation: { type: String, default: '' },
}, { _id: false });

const resultClueSchema = new mongoose.Schema({
  clueId: { type: String, required: true },
  description: { type: String, required: true },
  explanation: { type: String, required: true },
}, { _id: false });

const resultSchema = new mongoose.Schema({
  selectedSuspectId: { type: String, required: true },
  selectedSuspectName: { type: String, required: true },
  actualCulpritSuspectId: { type: String, required: true },
  actualCulpritName: { type: String, required: true },
  isCorrect: { type: Boolean, required: true },
  score: {
    total: { type: Number, required: true },
    maximum: { type: Number, required: true },
    accusationPoints: { type: Number, required: true },
    evidencePoints: { type: Number, required: true },
    reviewedEvidenceCount: { type: Number, required: true },
    availableEvidenceCount: { type: Number, required: true },
  },
  crimeExplanation: { type: String, required: true },
  finalExplanation: { type: String, required: true },
  actualSequenceOfEvents: { type: [String], default: [] },
  supportingClues: { type: [resultClueSchema], default: [] },
  supportingEvidence: { type: [resultEvidenceSchema], default: [] },
  misleadingEvidenceExplanations: { type: [resultEvidenceSchema], default: [] },
  timeline: { type: [timelineEventSchema], default: [] },
  completedAt: { type: Date, required: true },
}, { _id: false });

const investigationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scenario: { type: String, required: true, maxlength: 4000, select: false },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 500 },
    incidentSummary: { type: String, default: '', maxlength: 1200 },
    caseInfo: {
      location: { type: String, default: '' },
      incidentDateTime: { type: Date, default: null },
      background: { type: String, default: '' },
    },
    incidentDetails: {
      whatHappened: { type: String, default: '' },
      howItOccurred: { type: String, default: '' },
      possibleMotives: { type: [String], default: [] },
    },
    suspects: { type: [suspectSchema], default: [] },
    timeline: { type: [timelineEventSchema], default: [] },
    cluePlan: { type: [clueSchema], default: [], select: false },
    solution: { type: privateSolutionSchema, select: false },
    reviewedEvidenceIds: { type: [String], default: [] },
    accusation: { type: accusationSchema, select: false },
    result: { type: resultSchema, select: false },
    generationProgress: {
      stage: { type: String, default: 'queued' },
      percent: { type: Number, default: 0 },
      message: { type: String, default: 'Your case is in the queue.' },
    },
    generationError: {
      code: { type: String, select: false },
      detail: { type: String, select: false },
      message: { type: String, select: false },
      retryAvailableAt: { type: Date, select: false },
    },
    status: {
      type: String,
      enum: ['Generating', 'Ready', 'In Progress', 'Completed', 'Failed'],
      default: 'Generating',
      required: true,
    },
  },
  { timestamps: true },
);

investigationSchema.index({ userId: 1, createdAt: -1 });

export const Investigation = mongoose.model('Investigation', investigationSchema);
