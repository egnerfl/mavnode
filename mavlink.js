var mavlink = require("./mavlink");
var SerialPort = require("serialport").SerialPort;

//Serial port parameters
var COMPORT = "/dev/tty.usbserial-A603J17O";
var BAUD = 57600;
// ------- End of Configuration Section -------

//Quick and dirty MAVLink and server set up
var nodeMavLink = new mavlink();

//Added serial port just to test functionality of node module, all seems well so far!
//Gives an "Uncaught Error" message if nothings connected, silently ignored...
//TODO: Make this better, selectable serial or UDP/TCP
var serialPort = new SerialPort(COMPORT, {
	baudrate: BAUD
});

nodeMavLink.on("ATTITUDE", function(message, fields) {
    console.log(fields);
});

//Serial port testing, seems to work but incoming only
//TODO: Test this in both directions and make it better
serialPort.on("data", function (data) {
	nodeMavLink.parse(new Buffer(data));
});
