import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, required: true },
}, { _id: false });

const mediaSchema = new mongoose.Schema({
  mediaId: { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  storageRef: { type: String, required: true, select: false },
  mimeType: { type: String, required: true },
  generationStatus: {
    type: String,
    enum: ['pending', 'ready', 'failed', 'unavailable'],
    required: true,
  },
  message: { type: String, default: '' },
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  evidenceId: { type: String, required: true },
  investigationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investigation',
    required: true,
    index: true,
  },
  type: { type: String, enum: ['chat', 'image', 'cctv'], required: true },
  title: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 1000 },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  clueIds: { type: [String], default: [], select: false },
  reliability: {
    type: String,
    enum: ['supporting', 'contradictory', 'misleading', 'neutral'],
    required: true,
    select: false,
  },
  internalPurpose: { type: String, required: true, select: false },
  associatedSuspectIds: { type: [String], default: [] },
  timestamp: { type: Date, required: true },
  displayOrder: { type: Number, required: true },
  media: { type: [mediaSchema], default: [] },
  generationStatus: {
    type: String,
    enum: ['pending', 'ready', 'failed', 'unavailable', 'not_requested'],
    default: 'pending',
    required: true,
  },
  generationMessage: { type: String, default: '' },
}, { timestamps: true });

evidenceSchema.index({ investigationId: 1, displayOrder: 1 });
evidenceSchema.index({ investigationId: 1, evidenceId: 1 }, { unique: true });
evidenceSchema.index({ 'media.mediaId': 1 }, { unique: true, sparse: true });

export const Evidence = mongoose.model('Evidence', evidenceSchema);
