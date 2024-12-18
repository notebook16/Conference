import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";
import { useEffect } from "react";

function Home() {

  // const [usernameFound, setUsernameFound] = useState(false);
  // const [username, setUsername] = useState("");

  // const storedUsername = localStorage.getItem("username");

  // useEffect(() => {
  //   if (storedUsername) {
  //     setUsernameFound(true); // Set state if username is found
  //     setUsername(storedUsername)
  //   } else {
  //     setUsernameFound(false); // Set state if no username
  //   }
  // }, [storedUsername]); // Dependency array ensures it runs only when username changes



  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const { addToUserHistory } = useContext(AuthContext);
  let handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    // if (usernameFound) {
    //   // If usernameFound is true, navigate with state containing the username
    //   navigate(`/${meetingCode}`, { state: { username } });
    // } else {
    //   // If usernameFound is false, navigate without passing state
     navigate(`/${meetingCode}`);
    // }
  }

  return (
    <>
    <div  className="min-h-screen bg-gradient-to-br from-blue-400 via-pink-300 to-green-200
">
        <div className="navBar">
          <div style={{ display: "flex", alignItems: "center" }}>
           
            

            {/* <Button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                navigate("/");
              }}
            >
              Logout
            </Button> */}
          </div>
        </div>

        <div className="meetContainer min-h-screen flex justify-center items-center">
          <div className="leftPanel text-center">
            <div>
              <h2 className="mt-8 text-pretty text-lg font-medium text-black-500 sm:text-xl/8">Providing Quality Video Call Just Like oreo</h2>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <br></br>
                <TextField
                  onChange={(e) => setMeetingCode(e.target.value)}
                  id="outlined-basic"
                  label="Meeting Code"
                  variant="outlined"
                  className="w-full max-w-xs" // ensures responsiveness
                />
                <Button
                  onClick={handleJoinVideoCall}
                  variant="contained"
                  className="mt-4"
                >
                  Join
                </Button>
              </div>
            </div>
          </div>
        </div>
    </div>
    </>
  );
}

export default withAuth(Home);
