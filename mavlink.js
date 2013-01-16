var fs = require('fs'),
	xml2js = require('xml2js');
var EventEmitter = require('events').EventEmitter;
var parser = new xml2js.Parser();

//Container for message information
var mavlinkMessage = function(buffer) {
	this.length = buffer[1];
	this.sequence = buffer[2];
	this.system = buffer[3];
	this.component = buffer[4];
	this.id = buffer[5];
	this.payload = new Buffer(this.length);
	buffer.copy(this.payload,0,6,6+this.length);
	this.checksum = buffer.readUInt16LE(this.length+6);
	this.buffer = new Buffer(this.length + 8);
	buffer.copy(this.buffer,0,0,8+this.length);
}


var mavlink = function() {
	//MAVLink Version
	this.version = "v1.0";
	
	//Create message buffer
	this.buffer = new Buffer(512);
	this.bufferIndex = 0;
	this.messageLength = 0;
	
	//Message definitions
	this.definitions = new Array();
	this.addDefinition("common");
	this.addDefinition("ardupilotmega");
	
	this.messageChecksums = new Array();
	
	//Load definitions
	this.on("definitionsLoaded", function() { console.log("MAVLink: Definitions loaded"); });
	console.log("MAVLink: Loading definitions");
	this.loadDefinitions();
	
	this.lastCounter = 0;
};

mavlink.prototype = new EventEmitter;

//Add new definitions to the array
mavlink.prototype.addDefinition = function(definition) {
	this.definitions[this.definitions.length] = new Object();
	this.definitions[this.definitions.length-1].name = definition;
	this.definitions[this.definitions.length-1].messages = null;
	this.definitions[this.definitions.length-1].enums = null;
	console.log("MAVLink: Added " + definition + " definition");
}

//Load definitions from the XML files
mavlink.prototype.loadDefinitions = function() {
	//Loop over all definitions present, load them in turn
	for (var i = 0; i<this.definitions.length; i++) {
	
		//self invoking function to preserve loop values
		(function(self, i){
			console.log("MAVLink: Reading " + self.definitions[i].name + ".xml");
			
			//Read the XML file and parse it when loaded
			fs.readFile(__dirname + '/mavlink/message_definitions/' + self.version + '/' + self.definitions[i].name + '.xml', function(err, data) {
				
				//Pass XML data to the parser
				parser.parseString(data, function (err, result) {
					console.log("MAVLink: Parsing " + self.definitions[i].name + ".xml");
					
					//Extract the arrays of enums and messages
					self.definitions[i].messages = result['mavlink']['messages'][0].message;
					self.definitions[i].enums = result['mavlink']['enums'][0]['enum'];
					
					//Order fields in wire order and calculate checksums
					for (var j = 0 ; j < self.definitions[i].messages.length; j++) {
						self.orderFields(self.definitions[i].messages[j]);
						self.messageChecksums[self.definitions[i].messages[j].$.id] = self.calculateMessageChecksum(self.definitions[i].messages[j]);
					}
					
					//When last file has been parsed, emit event
					if (i == self.definitions.length-1) {
						self.emit("definitionsLoaded");
					}
				});
			});
		})(this,i); //Call of self invoking function
	}
};

//Order fields by type size
mavlink.prototype.orderFields = function(message) {

	//First make a few corrections
	for (var i=0; i<message.field.length; i++) {
		//add initial position in XML to preserve this if sizes equal (see sort function below)
		message.field[i].initialPos = i;
		
		//change a few types
		if (message.field[i].$.type == 'uint8_t_mavlink_version') {
			message.field[i].$.type = 'uint8_t';
		}
		if (message.field[i].$.type == 'array') {
			message.field[i].$.type = 'int8_t';
		}
	}
	
	//Sort fields by type length
	message.field.sort(function(a, b){
		//Define all the lengths
		var typeLengths = {
        'float'    : 4,
        'double'   : 8,
        'char'     : 1,
        'int8_t'   : 1,
        'uint8_t'  : 1,
        'uint8_t_mavlink_version'  : 1,
        'int16_t'  : 2,
        'uint16_t' : 2,
        'int32_t'  : 4,
        'uint32_t' : 4,
        'int64_t'  : 8,
        'uint64_t' : 8,
        }
		
		//Determine lengths of a and b
		var lenA = typeLengths[a.$.type.replace("[", " ").replace("]", " ").split(" ")[0]];
		var lenB = typeLengths[b.$.type.replace("[", " ").replace("]", " ").split(" ")[0]];
		
		//if lengths are equal, preserve initial ordering
		if (lenA == lenB) { 
			return a.initialPos - b.initialPos;
		} else {
		//otherwise reverse sort on size
			return lenB-lenA;
		}
	})
}

//Implementation of X25 checksum from mavutil.py
mavlink.prototype.calculateChecksum = function(buffer) {
	checksum = 0xffff;
	for (var i = 0; i < buffer.length; i++) {
		var tmp = buffer[i] ^ (checksum & 0xff);
		tmp = (tmp ^ (tmp<<4)) & 0xFF;
		checksum = (checksum>>8) ^ (tmp<<8) ^ (tmp<<3) ^ (tmp>>4)
		checksum = checksum & 0xFFFF
	}
	return checksum;
}

//Determine message checksums, based on message name, field names, types and sizes
mavlink.prototype.calculateMessageChecksum = function(message) {
	var checksumString = message.$.name + " ";
	for (var i = 0; i < message.field.length; i++) {
		var type = message.field[i].$.type.replace("[", " ").replace("]", " ").split(" ");
		checksumString += type[0] + " ";
		checksumString += message.field[i].$.name + " ";
		if (type[1] !== undefined) {
			checksumString += String.fromCharCode(type[1]);
		}
	}

	var checksum = this.calculateChecksum(new Buffer(checksumString));
	return (checksum&0xFF) ^ (checksum>>8);
}


//Function to return start charater depending on version
mavlink.prototype.startCharacter = function() {
	if (this.version == "v1.0") {
		return 0xFE;
	} else if (this.version == "v0.9") {
		return 0x55;
	}
}


mavlink.prototype.parseChar = function(ch) {
	//If we have no data yet, look for start character
	if (this.bufferIndex == 0 && ch == this.startCharacter()) {
		this.buffer[this.bufferIndex] = ch;
		this.bufferIndex++;
		return;
	}
	
	//Determine packet length
	if (this.bufferIndex == 1) {
		this.buffer[this.bufferIndex] = ch;
		this.messageLength = ch;
		this.bufferIndex++;
		return;
	}
	
	//Receiver everything else
	if (this.bufferIndex > 1 && this.bufferIndex < this.messageLength + 8) {
		this.buffer[this.bufferIndex] = ch;
		this.bufferIndex++;
	}
	
	//If we're at the end of the packet, see if it's valid
	if (this.bufferIndex == this.messageLength + 8) {
	
		if (this.version == "v1.0") {
			//Buffer for checksummable data
			var crc_buf = new Buffer(this.messageLength+6);
			this.buffer.copy(crc_buf,0,1,this.messageLength+6);
			
			//Add the message checksum on the end
			crc_buf[crc_buf.length-1] = this.messageChecksums[this.buffer[5]];
		} else {
			//Buffer for checksummable data
			var crc_buf = new Buffer(this.messageLength+5);
			this.buffer.copy(crc_buf,0,1,this.messageLength+6);
		}
		
		//Test the checksum
		if (this.calculateChecksum(crc_buf) == this.buffer.readUInt16LE(this.messageLength+6)) {
			//If checksum is good but sequence is screwed, fire off an event
			if (this.buffer[2] > 0 && this.buffer[2] - this.lastCounter != 1) {
				this.emit("sequenceError", this.buffer[2] - this.lastCounter - 1);
			}
			//update counter
			this.lastCounter = this.buffer[2];
			
			//fire an event with the message data
			var message = new mavlinkMessage(this.buffer);
			this.emit("messageReceived", message);
		} else {
			//If checksum fails, fire an event with some debugging information. Message ID, Message Checksum (XML), Calculated Checksum, Received Checksum
			this.emit("checksumFail", this.buffer[5], this.messageChecksums[this.buffer[5]], this.calculateChecksum(crc_buf), this.buffer.readUInt16LE(this.messageLength+6));
		}
		//We got a message, so reset things
		this.bufferIndex = 0;
		this.messageLength = 0;
	}
};

//Function to call parseChar on all characters in a buffer
mavlink.prototype.parse = function(buffer) {
	for (var i=0; i<buffer.length; i++) {
		this.parseChar(buffer[i]);
	}
}

module.exports = mavlink;
