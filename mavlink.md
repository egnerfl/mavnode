# Introduction #
This page details the functionality of the mavlink module. In summary this module does the following:

  * Reads in message definitions from the MAVLink XML files
  * Decodes either a series of individual characters or a Buffer object
  * Emits events when a valid message has been received, and on any errors
  * Constructs MAVLink encoded data packets from raw data


# Useful functions #
## Constructor ##
To create a new instance of mavlink, use the following
```
var myMavlink = new mavlink(sysid,compid);
```
where _sysid_ and _compid_ are the system and component ID's to be used for any packets constructed by the module. Note, these are not the ID's of the vehicle you wish to receive from as all valid MAVLink data will be decoded by the module regardless of source.

## Incoming data ##
To decode incoming data, two functions are provided. Use
```
myMavlink.parseChar(ch);
```
to parse incoming data one character (_ch_) at a time. Rather than looping through a character array yourself, use
```
myMavlink.parse(buf);
```
to parse an entire message at once. Note that _buf_ must be a valid buffer object, not simply a string. If your data is formatted as a string simply use
```
myMavlink.parse(new Buffer(str));
```

Neither the _parse_ and _parseChar_ functions return a value, instead an event is emitted when a complete packet has been processed. See [Events](mavlink#Events.md).

## Outgoing data ##
To construct a valid MAVLink packet from raw data the following function is provided.
```
myMavlink.createMessage(id, data);
```
_id_ is the ID of the message you wish to send. This can be either numerical or the actual name (case sensitive). _data_ is a JSON formatted object containing the fields of the message as name:value pairs. For example,
```
myMavlink.createMessage("ATTITUDE",{
   'time_boot_ms': 30,
   'roll':         0.1,
   'pitch':        0.2,
   'yaw':          0.3,
   'rollspeed':    0.4,
   'pitchspeed':   0.5,
   'yawspeed':     0.6
});
```
The _data_ fields need not be in the correct order, however all fields must be present (otherwise the packet is not constructed).

As with incoming data, the _createMessage_ function does not return a value, but emits an event on completion.

## Message structure ##
MAVLink messages are stored within the module as a data structure with the following format
```
myMessage.length;     //Payload length
myMessage.sequence;   //Sequence value
myMessage.system;     //System ID of sender
myMessage.component;  //Component ID of sender
myMessage.id;         //Message ID (numeric)
myMessage.payload;    //Message payload
myMessage.checksum;   //Msssage checksum
myMessage.buffer;     //Buffer object of entire message
```

## Events ##
The following events are emitted by the module

| **Event Name** | **Parameters** | **Description** |
|:---------------|:---------------|:----------------|
| definitionsLoaded | N/A | Emitted after the XML message definitions have been parsed |
| messageReceived | _msg_ the message received | Emitted after a valid packet has been decoded |
| sequenceError | _dropped_ number of messages missing | Emitted if any messages have been missed |
| checksumFail | _id_ message id <br /> _msgSum_ message checksum <br /> _calcSum_ calculated checksum <br /> _recvSum_ expected checksum | Emitted when an incoming message fails the checksum |
| messageCreated | _msg_ the message created | Emitted when a message has been constructed |

# Example use #
## Simple receive ##
An example of receiving MAVLink messages over a serial port and printing the hex data to the console.

```
var SerialPort = require("serialport").SerialPort;
var mavlink = require("./mavlink");

var myMavlink = new mavlink(255,1);
var myComport = new SerialPort("COM5", {baudrate: 115200});

myMavlink.on("definitionsLoaded", function() {
   myComport.on("data", function(data) {
      myMavlink.parse(new Buffer(data));
   });
});

myMavlink.on("messageReceived", function(msg) {
   console.log("Valid packet received from " + msg.sysid + ":" + msg.compid + "!");
   console.log("Contents: " + msg.buffer);
});

myMav.on("sequenceError", function(dropped) {
   console.log(dropped + " packets dropped!");
});

myMav.on("checksumFail", function(msgid, msgsum, calcsum, recvsum) {
   console.log("Checksum failed!");
});
```

## Simple send ##
An example of sending an attitude message over a serial port

```
var SerialPort = require("serialport").SerialPort;
var mavlink = require("./mavlink");

var myMavlink = new mavlink(255,1);
var myComport = new SerialPort("COM5", {baudrate: 115200});

myMavlink.on("messageCreated", function(msg) {
   myComport.write(msg.buffer);
});

myMavlink.on("definitionsLoaded", function() {
   myMavlink.createMessage("ATTITUDE",{
      'time_boot_ms': 30,
      'roll':         0.1,
      'pitch':        0.2,
      'yaw':          0.3,
      'rollspeed':    0.4,
      'pitchspeed':   0.5,
      'yawspeed':     0.6
   });
});
```