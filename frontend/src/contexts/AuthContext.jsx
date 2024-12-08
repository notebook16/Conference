import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

// Create a context using the "createContext" hook
export const AuthContext = createContext({});

// Create axios client
const client = axios.create({
    baseURL: "http://localhost:8000/api/v1/users"
});

// The main function that provides context for authentication
export const AuthProvider = ({ children }) => {
    // State for user data, initialized as null or empty object
    const [userData, setUserData] = useState(null);

    // Initialize the navigate function
    const navigate = useNavigate();

    // Function to handle registration
    const handleRegister = async (name, username, password) => {
        try {
            const request = await client.post("/register", {
                name: name,
                username: username,
                password: password
            });

            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }
        } catch (e) {
            console.error(e); // Log the error for debugging
            throw e; // Rethrow error to be handled by the calling function
        }
    };

    // Function to handle login
    const handleLogin = async (username, password) => {
        try {
            const request = await client.post("/login", {
                username: username,
                password: password
            });

            console.log(username, password);
            console.log(request.data);

            if (request.status === httpStatus.OK) {
                localStorage.setItem("token", request.data.token);
                navigate("/"); // Redirect to home page on successful login
            }
        } catch (e) {
            console.error(e); // Log the error for debugging
            throw e; // Rethrow error to be handled by the calling function
        }
    };



    const getHistoryOfUser = async () => {
        try {
            let request = await client.get("/get_all_activity", {
                params: {
                    token: localStorage.getItem("token")
                }
            });
            return request.data
        } catch
         (err) {
            throw err;
        }
    }

    const addToUserHistory = async (meetingCode) => {
        try {
            let request = await client.post("/add_to_activity", {
                token: localStorage.getItem("token"),
                meeting_code: meetingCode
            });
            return request
        } catch (e) {
            throw e;
        }
    }

    // Data that will be provided to children components
    const data = {
        userData,
        setUserData,
        handleRegister,
        handleLogin,
        addToUserHistory, 
        getHistoryOfUser
    };

    // Return the provider with children wrapped inside it
    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    );
};
