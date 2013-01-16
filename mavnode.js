var mavlink = require("./mavlink");
var dgram = require("dgram");
var http = require('http');
var url = require('url');
var SerialPort = require("serialport").SerialPort

// ------- Configuration Section -------
var DEBUG = 0;	//Debug Level
				//	0 - Off
				// 	1 - Errors
				//	2 - Errors + Useful Info

//IP and port of APM
var APM_IP = "192.168.1.2";
var APM_PORT = 10001;

//IP of Mission Planner
var MP_IP = "127.0.0.1";
var MP_PORT = 10002;

//Serial port parameters
var COMPORT = "COM5";
var BAUD = 115200;
// ------- End of Configuration Section -------

//Quick and dirty MAVLink and server set up, one in and one out
// _mp refers to (from) "Mission Planner"
var myMav = new mavlink();
var myMav_mp = new mavlink();
var server = dgram.createSocket("udp4");
var server_mp = dgram.createSocket("udp4");

//Added serial port just to test functionality of node module, all seems well so far!
//Gives an "Uncaught Error" message if nothings connected, silently ignored...
//TODO: Make this better, selectable serial or UDP/TCP
var serialPort = new SerialPort(COMPORT, {
	baudrate: BAUD
});

//Base port number for MATLAB stream, and maximum clients
var basePort = 30000;
var maxClients = 1024;

//Structure for client information
//	Remote Systems ID
//	Remote Component ID
//	Incomming Message ID (enums not currently supported)
//	IP of Remote System
//	Assigned port number
var messageClient = function(sysid, compid, msgid, address, port) {
	this.sysid = sysid;
	this.compid = compid;
	this.msgid = msgid;
	this.address = address;
	this.port = port;
}
//Array of all streams
var clients = Array(maxClients);

//Add a new client
function addClient(sysid, compid, msgid, address) {
	//Loop through array and find first free space (allows arbitrary deletion)
	for (var i = 0; i<clients.length; i++) {
		//If undefined or no port asigned (this is legacy, not sure its still needed)
		//TODO: Check this and remove
		if (clients[i] == undefined || clients[i].port == -1) {
			//Create new client and return it (so port number can be returned)
			clients[i] = new messageClient(sysid, compid, msgid, address, basePort+i);
			return clients[i];
		}
	}
	//Return null on failure
	return null;
}

//Delete a client. This assumes direct relationship between port and array index
//TODO: Make this strict, or get rid of the requirement
function removeClient(port) {
	delete clients[port-basePort];
}

//What to do when a valid MAVLink message has been received from APM
myMav.on("messageReceived", function(message) {
	//Print some debugging info if necessary
	if (DEBUG > 1) {
		console.log("Message ID " + message.id + " from APM to MP");
	}
	
	//Forward the entire packet straight on to MP
	server_mp.send(message.buffer,0,message.buffer.length,MP_PORT,MP_IP, function(err, bytes) {});
	
	//Check if any client streams are connected
	//TODO: This loop is costly, perhaps maintain a list of connected indices to save on the loop?
	for (var i=0; i<clients.length; i++) {
		//If a client is valid and requesting the correct data, send only the payload
		//NOTE: This sends the payload as it is transmitted, this does not necessarily correspond to the order it is listed in the XML file
		//TODO: Figure out a consistent way of sending this data, or informing client of data order
		if (clients[i] != undefined && clients[i].sysid == message.system && clients[i].compid == message.component && clients[i].msgid == message.id) {
			server_mp.send(message.payload,0,message.payload.length,clients[i].port,clients[i].address, function(err, bytes) {});
		}
	}
});

//If MAVLink losses a packet from APM, inform the user if debugging is on.
//NOTE: The latest APM builds (APMrover v2.20b) are out of sync with the latest MAVLink XML
//		msgid 36 has been changed so the checksums don't match. So this error pops up ~1/sec
myMav.on("sequenceError", function(dropped) {
	if (DEBUG) {
		console.log(dropped + " packets dropped from APM!");
	}
});

//If checksum fails from APM, inform the user if debugging is on
//NOTE: See above
myMav.on("checksumFail", function(msgid, msgsum, calcsum, recvsum) {
	if (DEBUG) {
		console.log("Checksum failed! (Msg: " + msgid + " [0x" + msgsum.toString(16) + "] Calc: 0x" + calcsum.toString(16) + " Recv: 0x" + recvsum.toString(16) + ")");
	}
});

//When MP sends data to APM, send it straight on
myMav_mp.on("messageReceived", function(message) {
	//Debugging message
	if (DEBUG > 1) {
		console.log("Message ID " + message.id + " from MP to APM");
	}
	server.send(message.buffer,0,message.buffer.length,APM_PORT, APM_IP, function(err, bytes) {});
	serialPort.write(message.buffer);
});

//If MAVLink losses a packet from MP, inform the user if debugging is on.
myMav_mp.on("sequenceError", function(dropped) {
	if (DEBUG) {
		console.log(dropped + " packets dropped from MP!");
	}
});

//Once MAVLink message definitions are loaded, bind server to port (for listening to incoming APM data)
//TODO:	This only checks for APM definitions, MP also reloads the same definitions. This should probably be static across all instances?
myMav.on("definitionsLoaded", function() {
	server.bind(10001);
});	

//What to do when we have a UDP message from APM
server.on("message", function (msg, rinfo) {
	//Check it is from APM, not spurios network traffic
	if (rinfo.address == APM_IP) {
		//Parse it as a MAVLink message
		myMav.parse(new Buffer(msg));
	} else {
		//Or tell the user its from somewhere else
//		console.log("Unknown... " + rinfo.address);
	}
});

//Serial port testing, seems to work but incoming only
//TODO: Test this in both directions and make it better
serialPort.on("data", function (data) {
	myMav.parse(new Buffer(data));
});

//What to do when we get data from MP, send it straight to the APM MAVLink parser
//TODO: This probably isn't needed as the connection should be good
server_mp.on("message", function (msg, rinfo) {
	myMav_mp.parse(new Buffer(msg));
});


//Very messy HTTP management code
//TODO: Make this a module on its own, lots more functionality needed...
http.createServer(function (req, res) {	//Create a server
	//Always return success and plain text
	res.writeHead(200, {'Content-Type': 'text/plain'});
	
	//Split up the URL
	//Format should be either
	//		http://127.0.0.1:4334/sysid/compid/msgid		to subscribe to a message
	//OR	http://127.0.0.1:4334/port						to unsubscribe from a message
	elements = url.parse(req.url).pathname.split("/");
	
	//Ignore spurious browser requests for icons
	if (elements[1] == "favicon.ico") {
		res.end("");
		return;
	}
	
	//If first element is a big number (above baseport, which should always be above 255, the highest sysid)
	//assume we want to delete a stream
	//TODO: Check theres no other elements
	//TODO: Just make this better in general!
	if (elements[1] >= basePort) {
		removeClient(elements[1]);
		console.log("Removing forward on port " + elements[1]);
		res.end("");
		return;
	}
	
	//If it wasn't a big number, assume its a request and break up the URL in to its parts
	sysid = elements[1];
	compid = elements[2];
	msgid = elements[3];
	
	//Attemps to add a new client, return (via HTTP) the port number if successful and inform the user (via terminal) of success or failure
	if ((client = addClient(sysid,compid,msgid,req.connection.remoteAddress)) != null ) {
		res.end(client.port + "\n");
		console.log("Forwarding Message ID " + msgid + " to " + req.connection.remoteAddress + ":" + client.port);
	} else {
		console.log("Too many clients connected! (Max: " + maxClients + ")");
	}
}).listen(4334, '0.0.0.0');	//Attach server to a port