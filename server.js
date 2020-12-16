const fs = require('fs'),
      http = require('http');

const port = process.env.PORT || 4100;
const express = require('express');
const app = express();
const server = app.listen(port, () => {
    console.log("Listening on port: " + port);
});

const LightController = require("./light-controller");

var lights = new LightController()

var io = require('socket.io-client'),
    socket = io(`http://localhost:4000`, {transports: ['websocket'], upgrade: false, path: "/io"});

socket.emit("join", {room: process.env["ROOM"] || "test"});

socket.on("joined", (resp) => {
  console.log("joined", resp)
})

socket.on("pixels", (data) => {
  lights.set(data);
})
