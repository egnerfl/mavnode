var node_mavlink = require("mavlink");
var SerialPort = require("serialport").SerialPort;
var express = require('express');
var app = express();
var http = require('http').Server(app);
var config = require('./config.json');
var io = require('socket.io')(http);
var fs = require("fs");

app.use(express.static(__dirname + '/webapp'));

//Quick and dirty MAVLink and server set up
var nodeMavLink = new node_mavlink();

nodeMavLink.on("message", function(message) {
	var messageId = nodeMavLink.getMessageName(message.id);

	io.emit("message", {
		type: messageId,
		message: nodeMavLink.decodeMessage(message)
	});
});

http.listen(config.express_port, function() {
	console.log('listening on *:' + config.express_port);
});

io.on('connection', function(socket) {
	console.log("Client connected");
});


//Test Data
fs.readFile(__dirname + '/APMDump.txt', function(err, data) {
	var j = 0;
	var readChunk = function() {
		console.log("APMDump loaded");
		for (i = 0; i < 100; i += 2) {
			var str = data.toString('utf8', j + i, j + i + 2);
			var ch = parseInt(str, 16);
			nodeMavLink.parseChar(ch);
			if (j + i > data.length - 5) {
				j = 0;
			}
		}
		j += 100;
	};
	//set Read Speed here
	setInterval(readChunk, 10);

});