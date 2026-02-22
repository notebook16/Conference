import { useState, useEffect } from "react";


import './App.css'
import LandingPage from './pages/landing'
import Auth from './pages/Auth'

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeet from './pages/VideoMeet';
import Home from './pages/Home';
import History from './pages/History';
import NewMeet from './pages/NewMeet';

function App() {

  // Stores last few context sentences
  const [contextLines, setContextLines] = useState([]);

  // Simulated incoming data in format: HH:MM:SS sentence
  const mockIncomingData = [
    "00:00:01 Hello everyone",
    "00:00:05 Today we will discuss project architecture",
    "00:00:10 Backend will be built using Node.js",
    "00:00:15 Frontend uses React",
    "00:00:20 Context window integration is assigned",
  ];

  // Parse timestamped input and maintain rolling context
  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      if (index < mockIncomingData.length) {
        const rawLine = mockIncomingData[index];

        // Remove timestamp (HH:MM:SS)
        const sentence = rawLine.replace(/^\d{2}:\d{2}:\d{2}\s*/, "");

        setContextLines((prev) => {
          const updated = [...prev, sentence];
          // Keep only last 5 sentences
          return updated.slice(-5);
        });

        index++;
      }
    }, 3000); // simulate new input every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* 🧠 Context Window */}
      <div
        style={{
          position: "fixed",
          right: "20px",
          top: "100px",
          width: "280px",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "12px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          zIndex: 1000,
        }}
      >
        <h4 style={{ marginBottom: "8px" }}>🧠 Context Window</h4>
        <ul style={{ fontSize: "14px", paddingLeft: "18px" }}>
          {contextLines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Existing App Routing */}
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/home" element={<Home />} />
            <Route path="/NewMeet" element={<NewMeet />} />
            <Route path="/history" element={<History />} />
            <Route path="/:url" element={<VideoMeet />} />
          </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}


export default App
