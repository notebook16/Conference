import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/videoMeet.module.css";
// import TextField from '@mui/material/TextField';
import Button from "@mui/material/Button";
import io from "socket.io-client";
import { Badge, IconButton, TextField } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

//our backend Url
const server_URL = "http://localhost:8000";

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
  let [showModel, setShowModel] = useState(true);

  //to handle messages states
  let [messages, setMessages] = useState([]); //for all messages
  let [message, setMessage] = useState(""); //for our writting message changes
  let [newMessages, setNewMessages] = useState(3); //for new message notification

  //ask for username who login as guest // ?
  let [askForUsername, setAskForUserName] = useState(true); //if get username do false and show room on true show only camera of their own
  let [username, setUsername] = useState("");

  var videoRef = useRef([]); //refereal to each video callers

  //When a new participant joins, their video needs to be added to the list, and the UI needs to update to display their stream.
  let [videos, setVideos] = useState([]); // ?

  //1. this will run once and ask for permission
  useEffect(() => {
    console.log("permisssion use effect")
    getPermissions();
  }, []);



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
    setAudio(!audio);
    // getUserMedia();
  };


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


let sendMessage = () => {
  console.log(socketRef.current);
  socketRef.current.emit('chat-message', message, username)
  setMessage("");

  // this.setState({ message: "", sender: username })
}


let handleEndCall = () => {
  try {
      let tracks = localVideoref.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
  } catch (e) { }
  window.location.href = "/"
}



  return (
    <div>
      {askForUsername === true ? (
        <div>
          <h2>Enter into Lobby </h2>

          <TextField
            id="outlined-basic"
            label="username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>

          <div>
            <video ref={localVideoref} autoPlay muted></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}> 

          {showModel ? <div className={styles.chatRoom}>

              <div className={styles.chatContainer}>
                    <h1>Chat</h1>

                    <div className={styles.chattingDisplay}>

                                {messages.length !== 0 ? messages.map((item, index) => {

                                    console.log(messages)
                                    return (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No Messages Yet</p>}


                            </div>


                            
                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={(e) => setMessage(e.target.value)} id="outlined-basic" label="Enter Your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>




              </div>





            </div>: <></> }

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton  onClick={handleEndCall} style={{ color: "red" }}>
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

            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton onClick={() => setShowModel(!showModel)} style={{ color: "white" }}>
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

          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
