const fs = require('fs'),
      http = require('http');

const port = process.env.PORT || 4100;
const express = require('express');
const app = express();
const server = app.listen(port, () => {
    console.log("Listening on port: " + port);
});

// const LightController = require("./light-controller");
const PixelDriver = require("./pixel-driver");

// var lights = new LightController()
var io = require('socket.io-client'),
    socket = io(`http://pi-pixel-server.herokuapp.com/`, {transports: ['websocket'], upgrade: false, path: "/io"});

// socket.emit("join", {room: process.env["ROOM"] || "test"});

// socket.on("joined", (resp) => {
//   console.log("joined", resp)

  
// })

// socket.on("pixels", (data) => {
//   // lights.set(data);
// })


var pixels = new PixelDriver();
  	pixels.start();

socket.on("strand", (data) => {
	switch(data.action) {
		case "add":
			pixels.addStrand(data)
			break;
		case "remove": 
			pixels.removeStrand(data);
			break;
		case "modify":
			pixels.updateStrand(data);
			break;
		default:
			break;
	}
})

socket.on("group", (data) => {
	switch(data.action) {
		case "add":
			pixels.addGroup(data)
			break;
		case "remove": 
			pixels.removeGroup(data);
			break;
		case "modify":
			pixels.updateGroup(data);
			break;
		default:
			break;
	}
})
