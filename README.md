Introduction
MAVNode is a Node.js based MAVLink proxy which enables 3rd party applications to subscribe to arbitrary data from any number of sources.

MAVNode is currently in the very early stages of development and has been developed with the following use case in mind.

An ArduPilot Mega (APM) system connected to a Serial to Ethernet adaptor performing a UDP multicast
MAVNode running on Windows receiving UDP packets via a Ubiquiti Wifi bridge
APM Mission Planner connected to MAVNode, receiving a direct pass through of all MAVLink encoded messages (and vice versa)
MATLAB/Simulink connected to MAVNode receiving specifically requested, decoded, messages
MATLAB/Simulink able to send messages to APM
Further development is underway to support multiple vehicles and/or instances of MAVNode for decentralisation purposes. E.g. Run MAVNode on board a vehicle and allow other vehicles to subscribe to its position information to enable formation control, whilst still allow a ground based C2 connection from Mission Planner and/or Simulink.

Serial port connection (for XBee or equivalent) is currently being tested.

Prerequisites
MAVNode is based on Node.js and has been developed using v0.8.16. Other versions may work but have not been tested.

The xml2js module is used to parse the MAVLink XML definitions, this is included in the node_modules directory.

The serialport module is used for serial connection support. This is included in the node_modules directory.

Although MAVNode should be compatible with anything talking MAVLink (v1.0 selected by default, but v0.9 is supported with a small change). It has only been tested with APM and APM Mission Planner.

Set Up
There is no configuration file/CLI at present, simply modify the top of the mavnode.js file

// ------- Configuration Section -------
var DEBUG = 0;  //Debug Level
                //      0 - Off
                //      1 - Errors
                //      2 - Errors + Useful Info

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
If you're only interested in a UDP connection, ignore the COMPORT/BAUD settings (and ignore the error about the comport on start). Likewise if you're not interested in UDP, ignore the APM_IP and APM_PORT settings. The Mission Planner (MP_IP/MP_PORT) settings are needed regardless if you intend to use Mission Planner. This should be the IP of the machine you wish to connect from and the UDP port you wish to use.

Testing
Running MAVNode
To run MAVNode, open a command window and navigate to the mavnode folder, then type.

node mavnode
If all is well you should see something like

events.js:2725: Uncaught Error: Opening \\.\COM5: File not found
MAVLink: Definitions loaded
MAVLink: Definitions loaded
The Uncaught Error can be ignored if you aren't using a serial connection (if you are, check you have set the COM port correctly).

If there are no other errors then everything should be working.

Connecting Mission Planner
To connect Mission Planner to MAVNode, simple select a UDP connection and enter the port number specified as MP_PORT in mavnode.js (10002 by default).

Connecting a non-MAVLink program
Receive a data stream
The primary purpose of MAVNode at present is to decode MAVLink data for external applications. The general process of receiving data from an external program is

Issue a HTTP request to MAVNode specifying the required data
MAVNode returns a port number in response
Listen for a UDP stream on the port number provided
Decode the binary data received as per the MAVLink specification
On termination of the application, issue another HTTP request informing MAVNode the stream is no longer required
The format of the initial HTTP request is

http://127.0.0.1:4334/requestStream/sysid/compid/msgid
Where MAVNode is running on 127.0.0.1 (the HTTP request port is hard coded to 4334), sysid and compid are the system and component ID's of the APM respectively (1 and 1 by default). msgid is the numerical id of the MAVLink message required (e.g. 30 for Attitude) or the text name of the message (case sensitive).

For example

http://127.0.0.1:4334/requestStream/1/1/30
or

http://127.0.0.1:4334/requestStream/1/1/ATTITUDE
requests the attitude data from system 1 component 1.

Upon receipt of this request MAVNode will return a port number as plain text, use this port to listen for incoming UDP data. This data will be binary formatted according to MAVLink specification. For example the attitude data contains 6 floats, for roll pitch and yaw angles and rates.

When finished with the stream, issue another HTTP request of

http://127.0.0.1:4334/terminateStream/port
Where port is the port number assigned from the first request. This informs MAVNode the data is no longer needed and the stream is stopped. For example

http://127.0.0.1:4334/terminateStream/30000
to stop a stream on port 30000.

Sending data to APM
To send a message to APM from an external (non-MAVLink) program a different HTTP request is used.

http://127.0.0.1:4334/send/sysid/compid/msgid?fields
Where sysid, compid and msgid are as in the receiving example above. fields is a GET string of name=value pairs for each field associated with the message to be sent. For example the RC_CHANNELS_OVERRIDE message is defined (in common.xml) as:

<message id="70" name="RC_CHANNELS_OVERRIDE">
   <description>The RAW values of the RC channels sent to the MAV to override info received from the RC radio. A value of -1 means no change to that channel. A value of 0 means control of that channel should be released back to the RC radio. The standard PPM modulation is as follows: 1000 microseconds: 0%, 2000 microseconds: 100%. Individual receivers/transmitters might violate this specification.</description>
   <field type="uint8_t" name="target_system">System ID</field>
   <field type="uint8_t" name="target_component">Component ID</field>
   <field type="uint16_t" name="chan1_raw">RC channel 1 value, in microseconds</field>
   <field type="uint16_t" name="chan2_raw">RC channel 2 value, in microseconds</field>
   <field type="uint16_t" name="chan3_raw">RC channel 3 value, in microseconds</field>
   <field type="uint16_t" name="chan4_raw">RC channel 4 value, in microseconds</field>
   <field type="uint16_t" name="chan5_raw">RC channel 5 value, in microseconds</field>
   <field type="uint16_t" name="chan6_raw">RC channel 6 value, in microseconds</field>
   <field type="uint16_t" name="chan7_raw">RC channel 7 value, in microseconds</field>
   <field type="uint16_t" name="chan8_raw">RC channel 8 value, in microseconds</field>
</message>
Therefore a HTTP request to set all channels to central (1500us) would be

http://127.0.0.1:4334/send/1/1/RC_CHANNELS_OVERRIDE?target_system=1&target_component=1&chan1_raw=1500&chan2_raw=1500&chan3_raw=1500&chan4_raw=1500&chan5_raw=1500&chan6_raw=1500&chan7_raw=1500&chan8_raw=1500
Connecting from Simulink
An example Simulink model is provided to demonstrate the use MAVNode.

Receiving
A masked subsystem is used to hide a UDP receive and Data Unpack block. The port number in the UDP received block is modified at run time by the InitFcn callback (found in Block Properties/Callbacks).

IP = get_param(gcb,'IP')                           
string = ['http://', IP, ':4334/requestStream/1/1/ATTITUDE']           
port = urlread(string);                            
set_param([gcb, '/UDP Receive'], 'Port',port);     
set_param([gcb, '/UDP Receive'], 'LocalPort',port);
This callback reads the IP address from the block mask. Forms the HTTP request string. Uses the urlread function to issue the request to MAVNode and set the Port and LocalPort parameters of the masked UDP Receive block.

As the model runs the UDP Receive block receives the incoming data and the Data Unpack turns this in to usable signals.

The StopFcn callback is used to issue the final HTTP request.

IP = get_param(gcb,'IP');                       
port = get_param([gcb, '/UDP Receive'], 'Port');
urlread(['http://', IP, ':4334/terminateStream', port]);       
Sending
A MATLAB function is called from Simulink to perform the required HTTP request.

function y = httpSend(c)

    str = 'http://127.0.0.1:4334/send/1/1/RC_CHANNELS_OVERRIDE';
    str = [str '?target_system=' num2str(floor(1))];
    str = [str '&target_component=' num2str(floor(1))];
    str = [str '&chan1_raw=' num2str(floor(c(1)))];
    str = [str '&chan2_raw=' num2str(floor(c(2)))];
    str = [str '&chan3_raw=' num2str(floor(c(3)))];
    str = [str '&chan4_raw=' num2str(floor(c(4)))];
    str = [str '&chan5_raw=' num2str(floor(c(5)))];
    str = [str '&chan6_raw=' num2str(floor(c(6)))];
    str = [str '&chan7_raw=' num2str(floor(c(7)))];
    str = [str '&chan8_raw=' num2str(floor(c(8)))];
    urlread(str);
    y = 1;
end
This is hooked up to a joystick reading block to test the functionality using a ground robot.

Development
MAVNode is in the very early stages of development. I'm happy to take any feature requests people may have!

Cloned from https://code.google.com/p/mavnode
