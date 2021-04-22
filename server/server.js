const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const dgram = require('dgram');
const cors = require('cors');
const fs = require("fs");

const socket = dgram.createSocket('udp4');
// app.set("view engine", "ejs");
// app.use(express.static("public"));

app.use(cors());

const port = 9000;

server.listen(port,
  function () {
    console.log(`App listening on port ${port}...`);
  }
);

app.get("/", (req, res) => {
  res.send("Hello!");
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`server udp listening ${address.address}:${address.port}`);
});

let buf = null;
let counter = 0;

const fileStream = fs.createWriteStream('video.h264');

socket.on('message', (msg, rinfo) => {
  // if (buf) {
  //   buf = Buffer.concat([buf, msg]);
  // } else {
  //   buf = msg;
  // }
  if (msg.toString() !== 'end') {
    counter++;
    const fragmentNumber = msg.slice(0, 4);
    console.log('message: ', msg);
    console.log('message length: ', msg.length);
    console.log('fragment number: ', fragmentNumber.readInt32BE());
    console.log('counter: ', counter);
    msg = msg.slice(4);
    fileStream.write(msg);
  }
  else {
    console.log(msg.toString());
    counter = 0;
    fileStream.end();  // end stream on msg about ending
    fileStream.close();
  }
});

// io.on("connection", (socket) => {
//   socket.on("join-room", (roomId, userId) => {
//     socket.join(roomId);
//     socket.to(roomId).broadcast.emit("user-connected", userId);

//     socket.on("disconnect", () => {
//       socket.to(roomId).broadcast.emit("user-disconnected", userId);
//     });
//   });
// });

socket.bind(41234);
