const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const dgram = require('dgram');
const cors = require('cors');

const socket = dgram.createSocket('udp4');
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(cors());

const port = 9000

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

socket.on('message', (msg, rinfo) => {
  console.log(`server udp got: ${msg} from ${rinfo.address}:${rinfo.port}`);
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId);

    socket.on("disconnect", () => {
      socket.to(roomId).broadcast.emit("user-disconnected", userId);
    });
  });
});

socket.bind(41234);
