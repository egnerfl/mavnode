#Setup

##Software Configuration

1. Install node.js
2. go in the mavnode root directory
3. run npm install

##Hardware Configuration

###PC (untested)

1. Setup 433/915mhz 3dr Modules via Mission Planner [[3dr instructions](http://planner.ardupilot.com/wiki/other-project-and-common-topics/common-optional-hardware/common-telemetry-landingpage/common-3dr-radio-version-2/#configuring_using_the_mission_planner)]
2. Find the used COM Port --> top right @ Mission Planner
3. Set the COM Port in the config.json file (serialPort)

###Mac (Linux)

1. Install FTDI Drivers [[FTDI Drivers](http://www.ftdichip.com/Drivers/VCP.htm)]
2. Use APM Planner to configure 433/915mhz 3dr Modules [[APM planner](http://ardupilot.com/downloads/?did=90)]
3. Find the used SerialInterface (in the Terminal sudo ls /dev/tty.* in my case /dev/tty.usbserial-A603J17O)
3. Set the SerialInterface in the config.json file (serialPort)

##Run mavnode

You need to have root access to use mavnode, just run (mac or linux) sudo node server.js in the mavnode root directory

To test mavnode without an mavlink capable device use the TestServer.js file
