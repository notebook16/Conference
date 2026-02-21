import mongoose from "mongoose";

const Schema = mongoose.Schema;

const TranscriptSegmentSchema = new Schema({
  meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
  sequence: { type: Number, required: true, index: true }, // strictly increasing sequence for ordering
  startTs: { type: Number, required: true }, // seconds
  endTs: { type: Number, required: true },
  text: { type: String, required: true },
  speakerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  confidence: { type: Number, default: null },
  isFinal: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

// unique constraint to avoid duplicate sequence inserts
TranscriptSegmentSchema.index({ meetingId: 1, sequence: 1 }, { unique: true, background: true });

const TranscriptSegment = mongoose.model("TranscriptSegment", TranscriptSegmentSchema);

export { TranscriptSegment };

