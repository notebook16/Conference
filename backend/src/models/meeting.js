import mongoose, { Schema } from "mongoose";

const ParticipantSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    displayName: { type: String, default: null },
    role: { type: String, default: "participant" }
}, { _id: false });

const meetingSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId, // Reference to the User model
            ref: "User", // Name of the User model
            required: true, // Ensure every meeting has a user reference
        },
        meetingCode: { type: String },
        date: { type: Date, default: Date.now },

        // New fields for transcription pipeline
        participants: { type: [ParticipantSchema], default: [] },
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
        transcriptStatus: {
            type: String,
            enum: ["live", "flushing", "archived"],
            default: "live"
        },
        transcriptDocumentId: { type: Schema.Types.ObjectId, ref: "TranscriptDocument", default: null }
    },
    { timestamps: true }
)

meetingSchema.index({ meetingCode: 1 });
meetingSchema.index({ user_id: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };