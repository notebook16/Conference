import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ContextSectionSchema = new Schema({
  title: { type: String },
  content: { type: String },
  startTs: { type: Number, default: null },
  endTs: { type: Number, default: null }
}, { _id: false });

const ContextSummarySchema = new Schema({
  // ObjectId when tied to Meeting; string when the pipeline uses URL-style room keys (same as TranscriptSegment).
  meetingId: { type: Schema.Types.Mixed, required: true, index: true },
  generatedAt: { type: Date, default: Date.now },
  sections: { type: [ContextSectionSchema], default: [] },
  modelMeta: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const ContextSummary = mongoose.model("ContextSummary", ContextSummarySchema);

export { ContextSummary };

