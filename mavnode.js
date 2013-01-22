var mavlink = require("./mavlink");
var dgram = require("dgram");
var httpServer = require('./httpServer');
var url = require('url');
var SerialPort = require("serialport").SerialPort

// ------- Configuration Section -------
var DEBUG = 2;	//Debug Level
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

//If a message has been created locally (from a non-MAVLink input stream), send straight to APM
myMav.on("messageCreated", function(message) {
	if (DEBUG > 1) {
		console.log("Message ID " + message.id + " from Simulink to APM");
	}
	server.send(message.buffer,0,message.buffer.length,APM_PORT, APM_IP, function(err, bytes) {});
	serialPort.write(message.buffer);
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


//Below is the set up for the HTTP server
//		Handlers for requestStream, terminateStream and send

//Request a (UDP) datastream from APM
//Issue a HTTP request with sysid, compid and message id (text or numeric)
//A port number is returned (plain text), which corresponds to the port that data will be sent on
//via UDP.
//For example:
//	http://127.0.0.1:4334/requestStream/1/1/27
//	http://127.0.0.1:4334/requestStream/1/1/ATTITUDE
httpServer.addHandler("requestStream", function(address, parameters, options) {
	var sysid = parameters[0];
	if (sysid <= 0 || sysid > 255) {
		return "ERROR: System ID " + sysid + " invalid!";
	}
	var compid = parameters[1];
	if (compid <= 0 || compid > 255) {
		return "ERROR: Component ID " + compid + " invalid!";
	}
	var msgid = parameters[2];
	var id = msgid;
	var idStr = "Message ID " + id;
	if (isNaN(Number(msgid))) {
		id = myMav.getMessageID(msgid);
		idStr = "Message " + msgid;
	}
	if (id < 0 || id > 255) {
		return "ERROR: " + idStr + " invalid!";
	}
	
	//Attemps to add a new client, return (via HTTP) the port number if successful and inform the user (via terminal) of success or failure
	if ((client = addClient(sysid,compid,id,address)) != null ) {
		console.log("Forwarding " + idStr + " to " + address + ":" + client.port);
		return client.port + "\n";
	} else {
		console.log("Too many clients connected! (Max: " + maxClients + ")");
		return "ERROR: Too many clients connected";
	}
});


//Remove a data stream (with no error checking on whether or not the stream actually exists!)
//TODO: Check stream exists first
//For example:
//	http://127.0.0.1:4334/terminateStream/30000
httpServer.addHandler("terminateStream", function(address, parameters, options) {
	if (parameters[0] >= basePort && parameters[0] <= 65535) {
		removeClient(parameters[0]);
		console.log("Removing forward on port " + parameters[0]);
		return "SUCCESS";
	} else {
		return "ERROR";
	}
});


//A simple (HTTP based) means of sending MAVLink data to APM
//Construct a URL query containing the sysid, compid and msgid
//Followed by a GET string of name=value pairs for each field in the message
//For example:
//	http://127.0.0.1:4334/send/1/1/ATTITUDE?time_boot_ms=30&roll=0.1&pitch=0.2&yaw=0.3&rollspeed=0.4&pitchspeed=0.5&yawspeed=0.6
httpServer.addHandler("send", function(address, parameters, options) {
var sysid = parameters[0];
	if (sysid <= 0 || sysid > 255) {
		return "ERROR: System ID " + sysid + " invalid!";
	}
	var compid = parameters[1];
	if (compid <= 0 || compid > 255) {
		return "ERROR: Component ID " + compid + " invalid!";
	}
	var msgid = parameters[2];
	var id = msgid;
	var idStr = "Message ID " + id;
	if (isNaN(Number(msgid))) {
		id = myMav.getMessageID(msgid);
		idStr = "Message " + msgid;
	}
	if (id < 0 || id > 255) {
		return "ERROR: " + idStr + " invalid!";
	}
	myMav.createMessage(id,options);
	return "";
});

httpServer.start();
