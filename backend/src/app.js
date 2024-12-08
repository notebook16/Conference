import express from  "express";
import {createServer} from "node:http";

import {Server} from "socket.io";


import mongoose from "mongoose";

import cors from "cors";

import{ connectToSocket } from "./controllers/socketManager.js";

import userRoutes from "./routes/user.js";


const app = express();
const server = createServer(app);
const io = connectToSocket(server);


//middlewares
app.use(cors()); //for allowing cross origin calls
app.use(express.json({limit: "40kb"})) //to parse json data from client and provide in req.body
app.use(express.urlencoded({limit: "40kb" , extended: true})) //to parse html form data from client and provide in req.body 



// import { fileURLToPath } from 'node:url';
// import { dirname, join } from 'node:path';


// const __dirname = dirname(fileURLToPath(import.meta.url));

// app.get('/', (req, res) => {
//   res.sendFile(join(__dirname, 'index.html'));
// });





// io.on('connection', (socket) => {
//     console.log('a user connected');
//     socket.on('disconnect', () => {
//       console.log('user disconnected');
//     });
//   });


// io.on('connection', (socket) => {
//     socket.on('chat message', (msg) => {
//       console.log('message: ' + msg);
//       io.emit('chat message' , msg);
//     });
//   });




app.use("/api/v1/users", userRoutes);



app.set("port", (process.env.PORT || 8000))







 
const start = async () => {
   
    
    const MONGO_URL = "mongodb+srv://navprince16:BP1RyQxjtyIOgNgR@conferencecluster.zsnek.mongodb.net/conferenceCluster?retryWrites=true&w=majority";

    //calling main function of db
    main().then(() => {
        console.log("connected to DB");
    }).catch((err) => {
        console.log(err);
    });

    async function main() {
        await mongoose.connect(MONGO_URL);
    }



    server.listen(app.get("port"), () => {
        console.log("LISTENIN ON PORT 8000")
    });



}


start();