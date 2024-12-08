import mongoose from "mongoose";

const Schema = mongoose.Schema;
import { Meeting } from "./meeting.js";

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
        unique: true, // Ensures usernames are unique
    },
    password: {
        type: String,
        required: true,
        minlength: 6, // Ensures a secure password
    },
    token: {
        type: String,
        default: null, // Optional default
    },
    meetings: [
        {
            type: Schema.Types.ObjectId,
            ref: "Meeting", // References the Meeting model
        },
    ],
});

// Index for improved query performance
userSchema.index({ userName: 1 });

const User = mongoose.model("User", userSchema);

export { User };
