import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";

function NewMeet() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const { addToUserHistory } = useContext(AuthContext);
  let handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <>
    <div  class="min-h-screen bg-gradient-to-br from-blue-400 via-pink-300 to-green-200
">
        <div className="navBar">
          <div style={{ display: "flex", alignItems: "center" }}>
            <IconButton
              onClick={() => {
                navigate("/history");
              }}
            >
              <RestoreIcon />
            </IconButton>
            <p>History</p>

            <Button
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/auth");
              }}
            >
              Logout
            </Button>
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
                  create meeting
                </Button>
              </div>
            </div>
          </div>
        </div>
    </div>
    </>
  );
}

export default withAuth(NewMeet);
