const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const video_stream_js = require('./index');
const cv = require('opencv4nodejs');
const Decoder = new video_stream_js.Decoder(10);
const dgram = require('dgram');
const WebSocket = require('ws');
const cors = require('cors');
const fs = require("fs");

const socket = dgram.createSocket('udp4');
// app.set("view engine", "ejs");
// app.use(express.static("public"));

function noop() {}

function heartbeat() {
  this.isAlive = true;
}

const wss = new WebSocket.Server({ port: 5050 });
let ws;

wss.on('connection', (socket) => {
  ws = socket;
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.send('hello!');
});

wss.on('message', (data) => {
  console.log('got message ', data);
});

const interval = setInterval(function ping()
{
    wss.clients.forEach(function each(ws)
    {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping(noop);
    });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});

socket.on('listening', () => {
  const address = socket.address();
  console.log(`server udp listening ${address.address}:${address.port}`);
});

let counter = 0;

const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);

// let writeStream = fs.createWriteStream('video.h264');

socket.on('message', (msg, rinfo) => {

  // if (buf) {
  //   buf = Buffer.concat([buf, msg]);
  // } else {
  //   buf = msg;
  // }

  if (Buffer.isBuffer(msg) && msg.toString() !== 'end') {
    counter++;
    // const fragmentNumber = msg.slice(0, 4);
    // console.log('===========');
    // console.log('message: ', msg);
    // console.log('message length: ', msg.length);
    // console.log('fragment number: ', fragmentNumber.readInt32BE());
    // console.log('counter: ', counter);
    msg = msg.slice(4);

    let frame = null;

    try {
      frame = Decoder.decode(msg);
    } catch (error) {
      console.log(error);
    }

    // console.log('frame: ', frame);
    if (frame)
    {
      const mat = new cv.Mat(frame.data, frame.height, frame.width, cv.CV_8UC1);
      // cv.imshow('img', mat);
      cv.waitKey(33);
      if (frame.data) {
        // cv.imwrite(`frames/${counter}.jpg`, mat);
        const multiScale = classifier.detectMultiScale(mat); // imitation of face recognition
        // console.log(multiScale);
        if (multiScale.objects.length >= 1 && ws) {
          console.log('got a face!');
          ws.send('got face');
          let date = new Date();
          let datetime = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear() + " " + date.getHours() + "-" + date.getMinutes();
          cv.imwrite(`frames/${datetime}.jpg`, mat);
        }
      }
    }

  }
  else {
    counter = 0;
  }
});

socket.bind(41234);
