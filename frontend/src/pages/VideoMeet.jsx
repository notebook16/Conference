import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/videoMeet.module.css";
// import TextField from '@mui/material/TextField';
import Button from "@mui/material/Button";
import io from "socket.io-client";
import {
  Badge,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import SummarizeIcon from "@mui/icons-material/Summarize";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import server from "../../environment";

function TypingSubtitleText({ text, speed = 22 }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    const fullText = String(text || "");
    if (!fullText) {
      setVisibleText("");
      return;
    }

    let i = 0;
    setVisibleText("");
    const timer = setInterval(() => {
      i += 1;
      setVisibleText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={styles.typingSubtitleText}>
      {visibleText}
      <span className={styles.typingCaret} aria-hidden />
    </span>
  );
}

function formatMeetingTime(s) {
  if (s == null || Number.isNaN(Number(s))) return "—";
  const total = Number(s);
  const m = Math.floor(total / 60);
  const r = total - m * 60;
  const hasFrac = Math.abs(r - Math.floor(r)) > 1e-6;
  const rStr = hasFrac ? r.toFixed(1) : String(Math.floor(r)).padStart(2, "0");
  return `${m}:${rStr}`;
}

/** e.g. 0:12 – 1:45 from seconds since meeting start */
function formatTimeRangeLabel(startTs, endTs) {
  if (startTs == null && endTs == null) return null;
  if (startTs != null && endTs != null) {
    return `${formatMeetingTime(startTs)} – ${formatMeetingTime(endTs)}`;
  }
  if (startTs != null) return formatMeetingTime(startTs);
  return formatMeetingTime(endTs);
}

function splitChainPoint(text) {
  const lines = String(text)
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { main: lines[0] || String(text), sub: lines.slice(1) };
}

/** API chain items: { text, startTs, endTs } or legacy string */
function normalizeContextChainPoint(point) {
  if (typeof point === "string") {
    const { main, sub } = splitChainPoint(point);
    return { main, sub, startTs: null, endTs: null };
  }
  const text = String(point.text ?? "").trim();
  const { main, sub } = splitChainPoint(text);
  const startTs =
    point.startTs != null && !Number.isNaN(Number(point.startTs)) ? Number(point.startTs) : null;
  const endTs =
    point.endTs != null && !Number.isNaN(Number(point.endTs)) ? Number(point.endTs) : null;
  return { main, sub, startTs, endTs };
}

function normalizeHighlightItem(h) {
  if (typeof h === "string") {
    return { text: h, startTs: null, endTs: null };
  }
  return {
    text: String(h.text ?? "").trim(),
    startTs: h.startTs != null && !Number.isNaN(Number(h.startTs)) ? Number(h.startTs) : null,
    endTs: h.endTs != null && !Number.isNaN(Number(h.endTs)) ? Number(h.endTs) : null,
  };
}


//our backend Url
const server_URL =  server

//here connections is differ from backend
//in backend path(room url) is a key and socket.id are the array value for it
//but here in connections the key is one socket.ID of pirticular room and
//value is the peer conection that will establish
var connections = {};

//STUN server to discover the device private-IP to Public-IP for connection
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeet() {
  //use to notify the server about the client that it want's to connect
  //you can use socketRef to emit events like join-call or listen to events like user-joined.
  var socketRef = useRef();
  var audioSocketRef = useRef();
  var mediaRecorderRef = useRef();
  var audioContextRef = useRef();
  var pcmCaptureRef = useRef({ processor: null, pcmBuffer: [], targetSampleRate: 16000 });
  let [captions, setCaptions] = useState([]);

  const [showContextPanel, setShowContextPanel] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(null);
  const [contextData, setContextData] = useState(null);

  const [showMeetingTimer, setShowMeetingTimer] = useState(true);
  const [meetingStartMs, setMeetingStartMs] = useState(null);
  const [nowMs, setNowMs] = useState(null);

  //use to store the users socket Id , use ti differntiate different people
  var socketIdRef = useRef(); 

  //This useRef is used to store the reference to the local video element (a DOM element) where your webcam feed will be displayed.
  var localVideoref = useRef();

  //use state to check audio, video,share-screen is avilavle by hardware
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [screenAvailable, setScreenAvailable] = useState(true);

  //use to on or off video and audio
  let [video, setVideo] = useState();
  let [audio, setAudio] = useState();

  //to share screen
  let [screen, setScreen] = useState();

  //This state is used to control the visibility of an emoji/hands-up modal. It tracks whether the modal should be shown or hidden.
  let [showModel, setShowModel] = useState(false);

  //to handle messages states
  let [messages, setMessages] = useState([]); //for all messages
  let [message, setMessage] = useState(""); //for our writting message changes
  let [newMessages, setNewMessages] = useState(3); //for new message notification

  const [chatUiMode, setChatUiMode] = useState("room");
  const [aiContextMode, setAiContextMode] = useState("context");
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiContextInfo, setAiContextInfo] = useState(null); // { upToTs, generatedAt }
  const [aiContextInfoLoading, setAiContextInfoLoading] = useState(false);

  //ask for username who login as guest // ?
  let [askForUsername, setAskForUserName] = useState(true); //if get username do false and show room on true show only camera of their own
  let [username, setUsername] = useState("");

  var videoRef = useRef([]); //refereal to each video callers

  //When a new participant joins, their video needs to be added to the list, and the UI needs to update to display their stream.
  let [videos, setVideos] = useState([]); // ?
  const latestCaption = captions.length > 0 ? captions[captions.length - 1] : null;

  //1. this will run once and ask for permission

  const getUsername = localStorage.getItem('username');
  console.log(`username from storage ${getUsername}`)

  useEffect(()=>{
    if(getUsername){
      setAskForUserName(false);
      getMedia();
    }
    else{
      setAskForUserName(true);
    }
  },[getUsername])

  useEffect(() => {
    console.log("permisssion use effect")
    getPermissions();
  }, []);
  const getGridStyle = (participantCount) => {
    if (participantCount === 1) {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
        height: '100%',
      };
    } else if (participantCount === 2) {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        height: '100%',
      };
    } else if (participantCount === 3) {
      return {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        height: '100%',
      };
    } else {
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gridGap: '10px',
        height: '100%',
      };
    }
  };
  
  

  let getDisplayMediaSuccess = (stream) => {
    console.log("HERE")
    try {
        window.localStream.getTracks().forEach(track => track.stop())
    } catch (e) { console.log(e) }

    window.localStream = stream
    localVideoref.current.srcObject = stream

    for (let id in connections) {
        if (id === socketIdRef.current) continue

        connections[id].addStream(window.localStream)

        connections[id].createOffer().then((description) => {
            connections[id].setLocalDescription(description)
                .then(() => {
                    socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                })
                .catch(e => console.log(e))
        })
    }

    stream.getTracks().forEach(track => track.onended = () => {
        setScreen(false)

        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { console.log(e) }

        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
        window.localStream = blackSilence()
        localVideoref.current.srcObject = window.localStream

        getUserMedia()

    })
}

  let getDisplayMedia = () => {
    if (screen) {
      if(screenAvailable){
        navigator.mediaDevices.getDisplayMedia(
          {video: true, audio: true}
        ).then(getDisplayMediaSuccess)
         .catch((e) => console.log(e));
      }
    }
  }

  //2. to get permissin for audio, video and screen share
  const getPermissions = async () => {
    console.log("permission granted");
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
        console.log("Video permission granted");
      } else {
        setVideoAvailable(false);
        console.log("Video permission denied");
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
        console.log("Audio permission granted");
      } else {
        setAudioAvailable(false);
        console.log("Audio permission denied");
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream; //add usere stream to local stream
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream; //show stream in video element
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  //use effect(2)
  //8.1 the change in audio video states will trigger this use effect
  //8.2 this will check the audio video states and call the method getUserMedia
  useEffect(() => {

    console.log("getUserMedia use effect called")
    if (video !== undefined && audio !== undefined) {
      console.log("Triggering getUserMedia due to state change:", video, audio);
      getUserMedia();
      console.log("SET STATE HAS ", video, audio);
    }
  }, [video, audio]);

  //6. this function (getMedia) triggers by step 5
  //7. it changes the state of video and audio to avilable permisssion here, video and audio are used in calls like when we toggle video aur audio during meeting
  //8(search for sub points). this change in video and audio states trigger the use effect(2) , which will handel the rest
  //9. then the connection beteeen peers is stablished with "connectToSocketServer"
  let getMedia = () => {
    console.log("get media called")
    if (!meetingStartMs) {
      const now = Date.now();
      setMeetingStartMs(now);
      setNowMs(now);
    }
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  //call after getUserMedia
  let getUserMediaSuccess = (stream) => {
    console.log("success called")
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        console.log(description);
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        })
    );

    if (stream.getAudioTracks().length > 0) {
      if (audioSocketRef.current?.connected) {
        startSendingAudio();
      } else {
        audioSocketRef.current?.once("connect", () => startSendingAudio());
      }
    }
  };

  //8.2.1 this function use used to get the current stream(can be audio or video) and send it to function "getMediaSuccess" for further operation

  let getUserMedia = () => {
    console.log("get user media called");
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess) //here it passes current stream from hardware to the "getUserMediaSuccess" function
        .then((stream) => {})
        .catch((err) => console.log(err));
    } else {
      try {
        //The getTracks() method returns an array of all the MediaStreamTrack objects in the media stream. These tracks can include video and audio tracks.
        //The stop() method is called on each track, which immediately stops capturing the associated media (e.g., video or audio).
        //Stopping the track releases hardware resources (like the camera or microphone) and effectively ends the media stream.
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {
        console.log(e);
      }
    }
  };

  let gotMessageFromServer = (fromId, message) => {
    console.log("got message from server called")
    var signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  //7.1 trigger by step 7 below,
  //establishes the connection between the frontend (client) and the backend (signaling server) for a WebRTC-based peer-to-peer video call application.
  let connectToSocketServer = () => {
    //for initiating the connection from frontend(client) to backend( signaling server)

    console.log("connect to socket called");

    //(S1)
    socketRef.current = io.connect(server_URL, { secure: false });
    // audio namespace for streaming microphone to server
    try {
      audioSocketRef.current = io.connect(`${server_URL}/audio`, { transports: ["websocket"] });
      audioSocketRef.current.on("connect", () => {
        console.log("audio socket connected", audioSocketRef.current.id);
        // join same room as signaling (use URL as meeting key)
        audioSocketRef.current.emit("join", window.location.href);
      });
      audioSocketRef.current.on("new-transcript", (seg) => {
        console.log("Received transcript from /audio namespace:", seg);
        // update captions UI
        setCaptions((c) => [
          ...c,
          {
            text: seg.text,
            start: seg.startTs,
            end: seg.endTs,
            speaker: seg.speakerId,
            participantSocketId: seg.participantSocketId || null,
          },
        ]);
      });
    } catch (e) {
      console.warn("Failed to connect audio socket:", e);
    }
    //listen at backend ->
    {
      /*io.on("connection", (socket) => {

                      console.log("SOMETHING CONNECTED") */
    }

    //emit from backend (Ln 50) ->
    {
      /*  .emit("signal", socket.id, message); })*/
    }
    socketRef.current.on("signal", gotMessageFromServer);

    //the socket connection establishment event ('connect') emitted automatically by the Socket.IO server when a client connects
    //that is when we intialize the connectio here as we did in above the sicket.IO emit this when client(fronend) is connected'
    //(S2)
    socketRef.current.on("connect", () => {
      //(S3)
      socketRef.current.emit("join-call", window.location.href);
      //listen at  backened ->
      {
        /* socket.on("join-call", (path) => {....    */
      }

      //storing the current user socketId
      //the "id" will generate by socketio automaticallly
      socketIdRef.current = socketRef.current.id;

      //use-case ->
      //emit from backend (Ln 76 ,    Ln42)
      {
        /*.emit("chat-message", data, sender, socket.id) */
      }
      socketRef.current.on("chat-message", addMessage);

      //when user left
      // emit from backend(Ln 95) ->
      {
        /* .emit('user-left', socket.id)   */
      }
      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });

      //from backend(Ln 37)
      //it is used to connect the new user to rest of the user
      //conclusion of join-call ->
      //the frontend emit the join-call event
      //the backend recieve it push the current socketId into the path
      //then it notify all the rest of the users about the new connections
      {
        /*.emit("user-joined", socket.id, connections[path])*/
      }
      //(S4)
      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          //(step-2)Establishing P2P connection for each client
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );

          //wait for their ice candiadate (public ip)
          //here ice candidate will generate and exchange
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          //wait for their video stream

          connections[socketListId].onaddstream = (event) => {
            console.log("on add stream");
            console.log("BEFORE:", videoRef.current);
            console.log("FINDING ID: ", socketListId);


            //here we find if the video that is present wether it's socket id is same as current client
            let videoExist = videoRef.current.find(
              (video) => video.socketId === socketListId 
            );

            if (videoExist) {
              console.log("video exist");

              //updating the stream of existing video

              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video
                );

                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              // Create a new video
              console.log("CREATING NEW");
              let newVideo = {
                socketId: socketListId, //here we explitctly assign socket it of new video to the videos array
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;//this holde the referals to eac active video
                return updatedVideos; //updated setVideos states after adding new video
              });
            }
          };


          //add a local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            //creating black screen if video is off
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence]);
            window.localStream = blackSilence;
            connections[socketListId].addStream(window.localStream);
          }
        });



        //here connections will begin
        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 == socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream); //add local stream in peer
            } catch (e) {}

            //creating offer
            connections[id2].createOffer() //created offer
            .then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };
  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  //3. click on connect
  //4. it sets "askForUsername" to false and sned it in video call section
  //5. this connect function call getMedia function
  let connect = () => {
    console.log("connect clicked")
    setAskForUserName(false);
    getMedia();
  };

  let handleVideo = () => {
    setVideo(!video);
    // getUserMedia();
  };
  let handleAudio = () => {
    const next = !audio;
    setAudio(next);
    // start/stop sending audio to backend when toggling audio on/off
    if (next) {
      startSendingAudio();
    } else {
      stopSendingAudio();
    }
    // getUserMedia();
  };

  // Raw PCM 16kHz 16-bit mono — required by ASR (backend forwards to gRPC; WebM is rejected)
  const ASR_WINDOW_SECONDS = 2.0;
  const CHUNK_MS = 100;

  const startSendingAudio = async () => {
    try {
      const capture = pcmCaptureRef.current;
      if (capture.processor) return;
      if (!audioSocketRef.current?.connected) {
        console.warn("audio socket not connected");
        return;
      }

      let stream = window.localStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks?.length) {
        console.warn("no audio tracks; cannot start PCM capture");
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error("Web Audio API not supported");
        return;
      }

      const TARGET_SAMPLE_RATE = 16000;
      const ctx = new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));

      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
      capture.processor = processor;
      capture.pcmBuffer = [];
      let seq = 0;
      const inputRate = ctx.sampleRate;
      const needResample = Math.abs(inputRate - TARGET_SAMPLE_RATE) > 100;
      const ratio = needResample ? inputRate / TARGET_SAMPLE_RATE : 1;

      function float32ToInt16(float32Array) {
        const int16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Array[i]));
          int16[i] = s < 0 ? s * 32768 : s * 32767;
        }
        return int16;
      }

      function downsampleTo16k(inputFloat) {
        if (!needResample) return float32ToInt16(inputFloat);
        const outLength = Math.floor(inputFloat.length / ratio);
        const out = new Int16Array(outLength);
        for (let i = 0; i < outLength; i++) {
          const srcIdx = i * ratio;
          const idx = Math.floor(srcIdx);
          const frac = srcIdx - idx;
          const s = idx + 1 < inputFloat.length
            ? inputFloat[idx] * (1 - frac) + inputFloat[idx + 1] * frac
            : inputFloat[idx];
          const clamped = Math.max(-1, Math.min(1, s));
          out[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
        }
        return out;
      }

      processor.onaudioprocess = (e) => {
        if (!audioSocketRef.current?.connected) return;
        const floatData = e.inputBuffer.getChannelData(0);
        const int16Data = downsampleTo16k(floatData);
        for (let i = 0; i < int16Data.length; i++) capture.pcmBuffer.push(int16Data[i]);
        const samplesPerChunk = (TARGET_SAMPLE_RATE * CHUNK_MS) / 1000;
        while (capture.pcmBuffer.length >= samplesPerChunk) {
          const chunk = capture.pcmBuffer.splice(0, samplesPerChunk);
          const buf = new Int16Array(chunk.length);
          for (let i = 0; i < chunk.length; i++) buf[i] = chunk[i];
          audioSocketRef.current.emit("stream-audio", {
            data: buf.buffer,
            encoding: "pcm_16k_16bit_mono",
            timestamp: Date.now(),
            meetingId: window.location.href,
            speakerId: username || "guest",
            participantSocketId: socketIdRef.current || socketRef.current?.id || "",
            seq: seq++,
          });
        }
      };

      source.connect(processor);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      processor.connect(gain);
      gain.connect(ctx.destination);
      console.log("PCM capture started (16kHz mono) for ASR — window ref", ASR_WINDOW_SECONDS, "s");
    } catch (err) {
      console.error("Failed to start sending audio:", err);
    }
  };

  const stopSendingAudio = () => {
    try {
      const capture = pcmCaptureRef.current;
      if (capture.processor) {
        try {
          capture.processor.disconnect();
        } catch (_) {}
        capture.processor = null;
        capture.pcmBuffer = [];
      }
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (audioSocketRef.current?.connected) {
        audioSocketRef.current.emit("end-audio");
      }
      console.log("PCM capture stopped");
    } catch (err) {
      console.error("Failed to stop sending audio:", err);
    }
  };

  // drive meeting elapsed timer
  useEffect(() => {
    if (!meetingStartMs) return;
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [meetingStartMs]);


 useEffect(() => {
    if (screen !== undefined) {
        getDisplayMedia();
    }
}, [screen])

let handleScreen = () => {
    setScreen(!screen);
}

let addMessage = (data,sender,socketIdSender) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: sender, data: data }
    ]);
    if (socketIdSender !== socketIdRef.current) {
        setNewMessages((prevNewMessages) => prevNewMessages + 1);
    }
}


  const sendAiMessage = async () => {
    const text = message.trim();
    if (!text || aiChatLoading) return;
    setAiChatMessages((prev) => [...prev, { role: "user", text }]);
    setMessage("");
    setAiChatLoading(true);
    try {
      const res = await fetch(`${server_URL}/api/v1/transcript/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: window.location.href,
          message: text,
          useContext: aiContextMode === "context",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      setAiChatMessages((prev) => [...prev, { role: "assistant", text: data.answer || "" }]);
    } catch (e) {
      setAiChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${e.message || String(e)}` },
      ]);
    } finally {
      setAiChatLoading(false);
    }
  };

let sendMessage = () => {
  if (chatUiMode === "ai") {
    sendAiMessage();
    return;
  }
  console.log(socketRef.current);
  socketRef.current.emit('chat-message', message, username)
  setMessage("");

  // this.setState({ message: "", sender: username })
}


  const fetchContextSummary = async ({ forceRebuild = false } = {}) => {
    setContextLoading(true);
    setContextError(null);
    try {
      const meetingId = window.location.href;
      const url = `${server_URL}/api/v1/transcript/generate-context-summary${
        !forceRebuild ? `?meetingId=${encodeURIComponent(meetingId)}` : ""
      }`;
      const res = await fetch(url, {
        method: forceRebuild ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: forceRebuild ? JSON.stringify({ meetingId }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      setContextData(data);
    } catch (e) {
      setContextError(e.message || String(e));
      setContextData(null);
    } finally {
      setContextLoading(false);
    }
  };

  const openContextPanel = () => {
    setShowModel(false);
    setShowContextPanel(true);
    // Only load existing summary; do not regenerate until user presses Refresh
    fetchContextSummary({ forceRebuild: false });
  };

  const fetchAiContextInfo = async ({ forceRebuild = false } = {}) => {
    setAiContextInfoLoading(true);
    try {
      const meetingId = window.location.href;
      const url = `${server_URL}/api/v1/transcript/generate-context-summary${
        !forceRebuild ? `?meetingId=${encodeURIComponent(meetingId)}` : ""
      }`;
      const res = await fetch(url, {
        method: forceRebuild ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: forceRebuild ? JSON.stringify({ meetingId }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${res.status})`);
      }
      const overviewSec = Array.isArray(data.sections)
        ? data.sections.find((s) => s.title === "Overview")
        : null;
      const upTo = overviewSec?.endTs ?? null;
      setAiContextInfo({
        upToTs: upTo,
        generatedAt: data.generatedAt || null,
      });
    } catch (e) {
      // On error, clear info but don't crash chat
      setAiContextInfo(null);
      console.error("Failed to load AI context info:", e);
    } finally {
      setAiContextInfoLoading(false);
    }
  };

  const closeContextPanel = () => {
    setShowContextPanel(false);
  };

let handleEndCall = () => {
  try {
    
      let tracks = localVideoref.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      delete connections[socketIdRef.current]
      console.log(` socked is ${connections[socketIdRef.current]}`)

  } catch (e) { }
  window.location.href = "/"
}



  return (
    <div className=" h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-400 via-pink-300 to-green-200">
      {askForUsername === true ? (
        <div className="flex flex-col justify-center items-center mt-16" 
        >
          
          <div >
            <video className="rounded-xl" ref={localVideoref} autoPlay muted></video>
          </div>

          <br></br>
          <h2 className="text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-7lg">Enter into Lobby </h2>
<br></br>
          <TextField
            id="outlined-basic"
            label="username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <br></br>
          <Button variant="contained" onClick={connect}>
            Join as guest
          </Button>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>

          {showMeetingTimer && meetingStartMs && nowMs ? (
            <div className={styles.meetingTimer}>
              <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatMeetingTime((nowMs - meetingStartMs) / 1000)}
              </span>
            </div>
          ) : null}

          {showContextPanel ? (
            <div className={styles.contextPanel}>
              <div className={styles.contextHeader}>
                <span className={styles.contextTitle}>Meeting context</span>
                <span style={{ display: "flex", gap: 4 }}>
                    <IconButton
                    size="small"
                    onClick={() => fetchContextSummary({ forceRebuild: true })}
                    disabled={contextLoading}
                    aria-label="Refresh context"
                    sx={{ color: "#94a3b8" }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={closeContextPanel}
                    aria-label="Close context"
                    sx={{ color: "#94a3b8" }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </span>
              </div>

              {contextLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <CircularProgress size={36} sx={{ color: "#38bdf8" }} />
                </div>
              )}

              {contextError && !contextLoading && (
                <Alert severity="error" sx={{ mb: 1, bgcolor: "rgba(127,29,29,0.35)", color: "#fecaca" }}>
                  {contextError}
                </Alert>
              )}

              {contextData && !contextLoading && (
                <>
                  {(() => {
                    const overviewSec = contextData.sections?.find((s) => s.title === "Overview");
                    const start = overviewSec?.startTs;
                    const end = overviewSec?.endTs;
                    if (start == null && end == null) return null;
                    return (
                      <div className={styles.timeBadge}>
                        <span>Transcript span</span>
                        <span>
                          {formatMeetingTime(start)} → {formatMeetingTime(end)}
                        </span>
                      </div>
                    );
                  })()}

                  {contextData.oneParagraphOverview ? (
                    <p className={styles.overviewText}>{contextData.oneParagraphOverview}</p>
                  ) : null}

                  <div className={styles.timeline}>
                    {(contextData.chain || []).map((point, idx) => {
                      const { main, sub, startTs, endTs } = normalizeContextChainPoint(point);
                      const timeLabel = formatTimeRangeLabel(startTs, endTs);
                      return (
                        <div key={idx} className={styles.timelineItem}>
                          <span className={styles.timelineConnector} aria-hidden />
                          <span className={styles.timelineDot} aria-hidden />
                          <div className={styles.stepBody}>
                            {timeLabel ? (
                              <div className={styles.stepTime}>{timeLabel}</div>
                            ) : null}
                            <div className={styles.stepRowHead}>
                              <span className={styles.stepIndex}>{idx + 1}.</span>
                              <span className={styles.stepMain}>{main}</span>
                            </div>
                            {sub.length > 0 ? (
                              <ul className={styles.subPoints}>
                                {sub.map((line, j) => (
                                  <li key={j}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Array.isArray(contextData.highlights) && contextData.highlights.length > 0 ? (
                    <div className={styles.highlightsBlock}>
                      <div className={styles.highlightsTitle}>Highlights</div>
                      <ul className={styles.subPoints} style={{ borderLeftColor: "rgba(56, 189, 248, 0.45)" }}>
                        {contextData.highlights.map((raw, i) => {
                          const hi = normalizeHighlightItem(raw);
                          const hlTime = formatTimeRangeLabel(hi.startTs, hi.endTs);
                          return (
                            <li key={i}>
                              {hlTime ? (
                                <span className={styles.highlightTime}>{hlTime} · </span>
                              ) : null}
                              {hi.text}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {showModel ? <div className={styles.chatRoom}>

              <div className={styles.chatContainer}>
                    <div className={styles.chatHeader}>
                      <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Chat</h1>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={chatUiMode}
                        onChange={(_, v) => v != null && setChatUiMode(v)}
                        aria-label="chat mode"
                      >
                        <ToggleButton value="room">Room</ToggleButton>
                        <ToggleButton value="ai">AI assistant</ToggleButton>
                      </ToggleButtonGroup>
                    </div>

                    {chatUiMode === "ai" ? (
                      <div className={styles.chatSubBar}>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={aiContextMode}
                          onChange={(_, v) => {
                            if (v != null) {
                              setAiContextMode(v);
                              if (v === "context" && !aiContextInfo && !aiContextInfoLoading) {
                                // Load existing summary for this meeting (no regeneration)
                                fetchAiContextInfo({ forceRebuild: false });
                              }
                            }
                          }}
                          aria-label="AI context mode"
                        >
                          <ToggleButton value="context">Meeting context</ToggleButton>
                          <ToggleButton value="general">General</ToggleButton>
                        </ToggleButtonGroup>
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          {aiContextMode === "context"
                            ? "Uses the latest saved meeting summary (no refresh unless you click)."
                            : "Chat with the model without using this meeting’s transcript."}
                        </Typography>
                        {aiContextMode === "context" ? (
                          <div style={{ marginTop: 8 }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => fetchAiContextInfo({ forceRebuild: true })}
                              disabled={aiContextInfoLoading}
                              sx={{
                                textTransform: "none",
                                backgroundColor: "#020617",
                                "&:hover": { backgroundColor: "#0f172a" },
                              }}
                            >
                              {aiContextInfoLoading
                                ? "Refreshing…"
                                : aiContextInfo && aiContextInfo.upToTs != null
                                ? `Context up to ${formatMeetingTime(aiContextInfo.upToTs)}`
                                : "Generate meeting context"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className={` overflow-y-auto  ${styles.chattingDisplay}`}>
                      {chatUiMode === "room" ? (
                        messages.length !== 0 ? (
                          messages.map((item, index) => (
                            <div style={{ marginBottom: "20px" }} key={index}>
                              <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                              <p>{item.data}</p>
                            </div>
                          ))
                        ) : (
                          <p>No messages yet</p>
                        )
                      ) : aiChatMessages.length !== 0 || aiChatLoading ? (
                        <>
                          {aiChatMessages.map((item, index) => (
                            <div
                              style={{
                                marginBottom: "16px",
                                textAlign: item.role === "user" ? "right" : "left",
                              }}
                              key={index}
                            >
                              <p
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                  marginBottom: 4,
                                }}
                              >
                                {item.role === "user" ? "You" : "Assistant"}
                              </p>
                              <p
                                style={{
                                  display: "inline-block",
                                  maxWidth: "92%",
                                  margin: 0,
                                  padding: "8px 12px",
                                  borderRadius: 12,
                                  background: item.role === "user" ? "#e0f2fe" : "#f1f5f9",
                                  textAlign: "left",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {item.text}
                              </p>
                            </div>
                          ))}
                          {aiChatLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
                              <CircularProgress size={28} />
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p>Ask the AI assistant anything. Turn on Meeting context to use the live transcript summary.</p>
                      )}
                    </div>

                    <div className={`fixed bottom-0  right-0 p-4 bg-white border-t border-gray-300 z-50 ${styles.chattingArea}`} >
                                <TextField
                                  value={message}
                                  onChange={(e) => setMessage(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      sendMessage();
                                    }
                                  }}
                                  id="chat-input"
                                  label={chatUiMode === "ai" ? "Message to AI" : "Enter your chat"}
                                  variant="outlined"
                                  fullWidth
                                  multiline
                                  maxRows={3}
                                  disabled={chatUiMode === "ai" && aiChatLoading}
                                />
                                <Button variant='contained' onClick={sendMessage} disabled={chatUiMode === "ai" && aiChatLoading}>
                                  Send
                                </Button>
                            </div>
              </div>
            </div>: <></> }

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton  onClick={handleEndCall}  style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>

            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton  onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : (
              <></>
            )}

            <IconButton
              onClick={() => {
                if (showContextPanel) closeContextPanel();
                else openContextPanel();
              }}
              style={{ color: showContextPanel ? "#38bdf8" : "white" }}
              aria-label="Meeting context summary"
              title="Meeting context"
            >
              <SummarizeIcon />
            </IconButton>

            <IconButton
              onClick={() => setShowMeetingTimer((prev) => !prev)}
              style={{ color: showMeetingTimer ? "#38bdf8" : "white" }}
              aria-label="Toggle meeting timer"
              title={showMeetingTimer ? "Hide meeting timer" : "Show meeting timer"}
            >
              <AccessTimeIcon />
            </IconButton>

            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton
                onClick={() => {
                  if (showModel) setShowModel(false);
                  else {
                    setShowContextPanel(false);
                    setShowModel(true);
                  }
                }}
                style={{ color: "white" }}
              >
                <ChatIcon />{" "}
              </IconButton>
            </Badge>
          </div>

          <video
            className={styles.meetUserVideo}
            ref={localVideoref}
            autoPlay
            muted
          />

          {/* Live captions display */}
          <div className={styles.liveCaptionContainer}>
            {latestCaption ? (
              <div
                key={`${latestCaption.start ?? "s"}-${latestCaption.end ?? "e"}-${latestCaption.text ?? ""}`}
                className={styles.liveCaptionItem}
              >
                <strong>{latestCaption.speaker || "Speaker"}:</strong>{" "}
                <TypingSubtitleText text={latestCaption.text || ""} />
              </div>
            ) : null}
          </div>

          <div className={styles.conferenceView} style={getGridStyle(videos.length)}>
            {videos.map((video) => (
              <div key={video.socketId} className={styles.participantTile}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
                {latestCaption && latestCaption.participantSocketId === video.socketId ? (
                  <div className={styles.participantSubtitleOverlay}>
                    <TypingSubtitleText text={latestCaption.text || ""} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
