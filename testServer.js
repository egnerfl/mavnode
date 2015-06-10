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
	console.log("APMDump loaded!");
	var j = 0;
	var readChunk = function() {
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

// Video Websocket Server
var videoWsServer = new (require('ws').Server)({port: config.video.WEBSOCKET_PORT});
videoWsServer.on('connection', function(socket) {
	// Send magic bytes and video size to the newly connected socket
	// struct { char magic[4]; unsigned short config.video.width, config.video.height;}
	var streamHeader = new Buffer(8);
	streamHeader.write(config.video.STREAM_MAGIC_BYTES);
	streamHeader.writeUInt16BE(config.video.width, 4);
	streamHeader.writeUInt16BE(config.video.height, 6);
	socket.send(streamHeader, {binary:true});

	console.log( 'New WebSocket Connection ('+videoWsServer.clients.length+' total)' );
	
	socket.on('close', function(code, message){
		console.log( 'Disconnected WebSocket ('+videoWsServer.clients.length+' total)' );
	});
});

videoWsServer.broadcast = function(data, opts) {
	for( var i in this.clients ) {
		if (this.clients[i].readyState == 1) {
			this.clients[i].send(data, opts);
		}
		else {
			console.log( 'Error: Client ('+i+') not connected.' );
		}
	}
};

// HTTP Server to accept incomming MPEG Stream
var videoStreamServer = require('http').createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

	if( params[0] == config.video.STREAM_SECRET ) {
		config.video.width = (params[1] || 320)|0;
		config.video.height = (params[2] || 240)|0;
		
		console.log(
			'Stream Connected: ' + request.socket.remoteAddress + 
			':' + request.socket.remotePort + ' size: ' + config.video.width + 'x' + config.video.height
		);
		request.on('data', function(data){
			videoWsServer.broadcast(data, {binary:true});
		});
	}
	else {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + 
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}
}).listen(config.video.STREAM_PORT);

console.log("run", "ffmpeg -s "+config.video.height+"x"+config.video.width+" -f "+config.video.format+" -i " + config.video.device + " -f mpeg1video -b 800k -r 30 http://localhost:"+config.video.STREAM_PORT+"/"+config.video.STREAM_SECRET+"/"+config.video.height+"/"+config.video.width+"/")