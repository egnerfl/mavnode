var mavlink = require("./mavlink");
var httpServer = require("./httpServer");

var MAV = new mavlink(255,1);

MAV.on("messageReceived", function(msg) {
	console.log("Message " + msg.id + " Received!");
});

MAV.on("definitionsLoaded", function() {
	MAV.on("messageCreated", function(msg) {
		MAV.parse(msg);
	});
	MAV.createMessage("ATTITUDE",{
		'time_boot_ms':30,
		'roll':0.1,
		'pitch':0.2,
		'yaw':0.3,
		'rollspeed':0.4,
		'pitchspeed':0.5,
		'yawspeed':0.6
	});
	MAV.createMessage("CHANGE_OPERATOR_CONTROL",{
		'target_system':30,
		'control_request':1,
		'version':1,
		'passkey':'abcdefg'
	});
});

httpServer.addHandler("requestStream", function(parameters,options) {
	var out = parameters[0] + " " + parameters[1] + " " + streams++;
	return out;
});
httpServer.start();
