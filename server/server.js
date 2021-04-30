const express = require("express");
const app = express();
const crypto = require('crypto');
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

let currentNumber = 0;
let queue = [];
let face = false;
let session = null;
let received_sps = false;
let received_pps = false;

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
  ws.on('message', (data) => {
    console.log('websocket got message ', data);
    switch (data) {
      case 'start':
        currentNumber = 0;
        queue = [];
        received_sps = false;
        received_pps = false;
        session = crypto.randomBytes(4).toString('hex');
        ws.send(session);
        console.log('session id: ', session);
        break;
      default:
        break;
    }
  });
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
  console.log('ws connection was closed');
  clearInterval(interval);
});

socket.on('listening', () => {
  const address = socket.address();
  console.log('=======================================================');
  console.log(`server udp listening ${address.address}:${address.port}`);
});

socket.on('connect', () => {
  console.log('connected!');
})

const classifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);

function decode(msg, number) {
  msg = msg.slice(4);
  let frame = null;
  console.log('decoding fragment ', number);

  try {
    frame = Decoder.decode(msg);
  } catch (error) {
    // console.log(error);
  }

  if (frame)
  {
    const mat = new cv.Mat(frame.data, frame.height, frame.width, cv.CV_8UC1);
    // cv.imshow('img', mat);
    cv.waitKey(33);
    if (frame.data) {
      const multiScale = classifier.detectMultiScale(mat); // imitation of face recognition
      // console.log(multiScale);
      if (multiScale.objects.length >= 1 && ws) {
        console.log('got a face! fragment number ', number);
        ws.send('got face');
        face = true;
        session = null;
        currentNumber = 0;
        queue.length = 0;
        received_pps = false;
        received_sps = false;
        let date = new Date();
        let datetime = date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear() + " " + date.getHours() + "-" + date.getMinutes();
        cv.imwrite(`frames/${datetime}.jpg`, mat);
      }
    }
  }
}

socket.on('message', (msg, rinfo) => {
  if (Buffer.isBuffer(msg)) {
    const fragmentNumber = msg.slice(0, 4).readInt32BE();
    const fragmentSession = msg.slice(4, 8).toString('hex');

    let header = msg[12];
    let obj = {
        forbidden_zero_bit: (header & 0x80) >> 7,
        nal_ref_idc: (header & 0x60) >> 5,
        nal_unit_type: (header & 0x1F)
    };

    if (session && fragmentSession === session && received_sps && received_pps) {

      // console.log('nal unit type: ', obj.nal_unit_type);

      if (currentNumber === fragmentNumber) {
        console.log('decoding as usual');
        decode(msg, fragmentNumber);
        currentNumber++;
      }
      else if (obj.nal_unit_type === 5 && fragmentNumber > currentNumber) {
        console.log('recieved and IDR with fragment number greater than the current');
        currentNumber = fragmentNumber;
        decode(msg, fragmentNumber);
        currentNumber++;
      }
      else {
        // console.log('current number: ', currentNumber);
        // console.log('fragment number: ', fragmentNumber);
        queue[fragmentNumber] = msg;
      }

      while (queue[currentNumber] !== undefined) {
        decode(queue[currentNumber], currentNumber);
        currentNumber++;
      }

      console.log('objects from queue were decoded');

    }
    else if (session && fragmentSession === session && obj.nal_unit_type === 7) {
      decode(msg, fragmentNumber);
      currentNumber = fragmentNumber + 1;
      received_sps = true;
    }
    else if (session && fragmentSession === session && obj.nal_unit_type === 8) {
      received_pps = true;
      if (received_sps) {
        decode(msg, fragmentNumber);
        currentNumber = fragmentNumber + 1;
        console.log('received pps & sps and went to cycle');
        while (queue[currentNumber] !== undefined) {
          decode(queue[currentNumber], currentNumber);
          currentNumber++;
        }
      }
      else {
        queue[fragmentNumber] = msg;
      }
    }
    else if (session && fragmentSession === session) {
      queue[fragmentNumber] = msg;
    }

  }
});

socket.bind(41234);
