const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const video_stream_js = require('./index');
const cv = require('opencv4nodejs');
const Decoder = new video_stream_js.Decoder(10);
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

// let writeStream = fs.createWriteStream('video.h264');

socket.on('message', (msg, rinfo) => {
  // if (buf) {
  //   buf = Buffer.concat([buf, msg]);
  // } else {
  //   buf = msg;
  // }
  if (Buffer.isBuffer(msg) && msg.toString() !== 'end') {
    counter++;
    const fragmentNumber = msg.slice(0, 4);
    console.log('===========');
    console.log('message: ', msg);
    console.log('message length: ', msg.length);
    console.log('fragment number: ', fragmentNumber.readInt32BE());
    console.log('counter: ', counter);
    msg = msg.slice(4);

    let frame = Decoder.decode(msg);
    console.log('frame: ', frame);
    if (frame)
    {
      const mat = new cv.Mat(frame.data, frame.height, frame.width, cv.CV_8UC1);
      cv.imshow('img', mat);
      cv.waitKey(33);
    }

    // writeStream.write(msg);
  }
  else {
    console.log(msg.toString());
    counter = 0;
    // writeStream.end();  // end stream on msg about ending
    // fileStream.close();
  }
});

// writeStream.on('finish', () => {
//   console.log('wrote all data to file');
// });

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
