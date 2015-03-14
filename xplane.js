dgram = require("dgram");

xplanePacket = function(buffer) {
	if (buffer.toString('utf8', 0, 4) !== "DATA") {
		console.log("Not an X-Plane data packet!");
		return;
	}
	var index = buffer.readInt32LE(5);
	console.log(index);
}



dgram.createSocket("udp4", function(msg, rinfo) {
	packet = new xplanePacket(msg);
}).bind(49005);