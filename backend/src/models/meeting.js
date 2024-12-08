import mongoose, { Schema } from "mongoose";


const meetingSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId, // Reference to the User model
            ref: "User", // Name of the User model
            required: true, // Ensure every meeting has a user reference 
            
        },
        meetingCode: { type: String},
        date: { type: Date, default: Date.now }
    }
)

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };