var node_mavlink = require("mavlink");
var SerialPort = require("serialport").SerialPort;
var express = require('express');
var app = express();
var http = require('http').Server(app);
var config = require('./config.json');
var io = require('socket.io')(http);

app.use(express.static(__dirname + '/webapp'));

//Quick and dirty MAVLink and server set up
var nodeMavLink = new node_mavlink();

//Added serial port just to test functionality of node module, all seems well so far!
//Gives an "Uncaught Error" message if nothings connected, silently ignored...
//TODO: Make this better, selectable serial or UDP/TCP
var serialPort = new SerialPort(config.serialPort, {
	baudrate: config.serialBaudrate
});

nodeMavLink.on("message", function(message) {
	var messageType = nodeMavLink.getMessageName(message.id);

	io.emit("message", {
		type: messageType,
		message: nodeMavLink.decodeMessage(message)
	});
});

//Serial port testing, seems to work but incoming only
//TODO: Test this in both directions and make it better
serialPort.on("data", function (data) {
	nodeMavLink.parse(new Buffer(data));
});

app.get('/', function(req, res){
  res.send('<h1>Hello world</h1>');
});

http.listen(config.express_port, function(){
  console.log('listening on *:' + config.express_port);
});

io.on('connection', function (socket) {
	console.log("Client connected");
});