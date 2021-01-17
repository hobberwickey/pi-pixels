const fs = require('fs'),
      http = require('http');

const port = process.env.PORT || 4100;
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const server = app.listen(port, () => {
    console.log("Listening on port: " + port);
});

app.use(bodyParser.json());

// app.get('/devices/:action', (req, res) => {
// 	console.dir(req.body);

// 	switch(req.params.action) {
// 		case "add":
// 			// pixels.addDevice(data)
// 			break;
// 		case "remove": 
// 			// pixels.removeDevice(data);
// 			break;
// 		case "modify":
// 			// pixels.updateDevice(data);
// 			break;
// 		default:
// 			break;
// 	}

// 	res.json({success: true});
// })

// app.get('/controllers/:action', (req, res) => {

// })

// app.get('/strand/:action', (req, res) => {

// })

// app.get('/group/:action', (req, res) => {

// })

// const LightController = require("./light-controller");
const PixelDriver = require("./pixel-driver");
const pixels = new PixelDriver();
  		pixels.start();

// var lights = new LightController()
var io = require('socket.io-client'),
    socket = io(`http://pi-pixel-server.herokuapp.com/`, {transports: ['websocket'], upgrade: false, path: "/io"});

socket.emit("join", {room: process.env["ROOM"] || "test"});
socket.on("joined", (resp) => {
	socket.emit("device", {room: process.env["ROOM"] || "test", devices: pixels.devices})
})

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

	socket.emit("device", {room: process.env["ROOM"] || "test", devices: pixels.devices})
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

	socket
})
