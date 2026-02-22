import React, { useContext, useState, useEffect } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import styles from "../styles/home.module.css";
import { Button, TextField } from "@mui/material";
import { AuthContext } from "../contexts/AuthContext";

function Home() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.navBar}>
        <div className={styles.brand}>ClayConf</div>
      </header>

      <main className={styles.meetContainer}>
        <section className={styles.card}>
          <h2 className={styles.title}>
            Providing quality video calls — soft, colorful, and claymorphic
          </h2>

          <div className={styles.form}>
            <TextField
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              label="Meeting Code"
              variant="outlined"
              className={styles.input}
            />
            <Button
              onClick={handleJoinVideoCall}
              variant="contained"
              className={styles.button}
            >
              Join
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default withAuth(Home);
