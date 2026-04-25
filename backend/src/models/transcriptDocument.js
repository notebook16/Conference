import mongoose from "mongoose";

const Schema = mongoose.Schema;

const TranscriptDocumentSchema = new Schema({
  // Same room key as TranscriptSegment (URL or Mongo Meeting id).
  meetingId: { type: Schema.Types.Mixed, required: true, index: true },
  segments: [{ type: Schema.Types.ObjectId, ref: "TranscriptSegment" }], // ordered list of segment ids
  lastFlushedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
  transcriptMarkdownUrl: { type: String, default: null } // optional external storage pointer
}, { timestamps: true });

TranscriptDocumentSchema.index({ meetingId: 1, version: -1 });

const TranscriptDocument = mongoose.model("TranscriptDocument", TranscriptDocumentSchema);

export { TranscriptDocument };

