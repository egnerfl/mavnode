var mavlink = require("./mavlink");
var fs = require("fs");
var net = require('net');

function sleep(milliSeconds) {
    var startTime = new Date().getTime();
    while (new Date().getTime() < startTime + milliSeconds);
  }

var myMav = new mavlink();
myMav.on("definitionsLoaded", function() {
	fs.readFile(__dirname + '/APMDump.txt', function(err, data) {
		var j = 0;
		var readChunk = function() {
			for (i = 0; i<100; i+=2) {
				var str = data.toString('utf8', j+i,j+i+2);
				var ch = parseInt(str,16);
				myMav.parseChar(ch);
				if (j+i > data.length-5) {
					j = 0;
				}
			}
			j+=100;
		};
		setInterval(readChunk,1);
		
	});
});
//myMav.on("messageReceived", function(message) {
//	console.log(message.id);
//});
var server = net.createServer(function (socket) {
	myMav.on("messageReceived", function(message) {
		socket.write(message.buffer);
	});
});
server.on("listening", function() { console.log("Listening...");});
server.on("connection", function() { console.log("Connection...");});
server.listen(12345);
