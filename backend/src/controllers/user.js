import httpStatus from "http-status";
import { User } from "../models/user.js";
import bcrypt, { hash } from "bcrypt"

import crypto from "crypto"
import { Meeting } from "../models/meeting.js";


const login = async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Please Provide" })
    }

    try {
        const user = await User.findOne({ userName: username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" })
        }


        let isPasswordCorrect = await bcrypt.compare(password, user.password)

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            await user.save();
            return res.status(httpStatus.OK).json({ token: token })
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid Username or password" })
        }

    } catch (e) {
        return res.status(500).json({ message: `Something went wrong ${e}` })
    }
}



const register = async (req, res) => {
    const { name, username, password } = req.body;


    try {
        const existingUser = await User.findOne({ userName: username });
        if (existingUser) {
            return res.status(httpStatus.FOUND).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            userName: username,
            password: hashedPassword
        });

        await newUser.save().then(console.log("saved"));

        res.status(httpStatus.CREATED).json({ message: "User Registered" })

    } catch (e) {
        res.json({ message: `Something went wrong ${e}` })
    }

}





const addToHistory = async (req, res) => {
    const { token, meetingCode } = req.body;

    // Find user by token
    const user = await User.findOne({token: token });
    if (!user) {
        return res.status(401).json({ message: "Invalid token" });
    }

    // Create a new meeting
    const meeting = new Meeting({
        user_id: user._id, // Link to the user
        meetingCode,
    });

    await meeting.save();

    // Add meeting to the user's meeting history
    user.meetings.push(meeting._id);
    await user.save();

    res.status(201).json({ message: "Meeting created", meeting });
};

const getUserHistory = async(req,res) =>{

    const {token} =  req.query;


    // Find user by token
    const user = await User.findOne({ token: token }).populate("meetings");
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ meetings: user.meetings });

}



export { login, register, addToHistory , getUserHistory }