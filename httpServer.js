var http = require('http');
var url = require('url');

handlers = new Object();
port = 4334;	//Default port for now

//Simple HTTP server which takes a URL of the form
//		http://127.0.0.1:4334/handle/p1/p2/p3?a=1&b=2&c=3
//and calls the function handle with the remote IP, parameters and options
//
// The parameters are passed as an array [p1, p2, p3] and the options as
// an object {a: 1, b: 2, c: 3}
//
// The function handle should return a string to be sent to the client
function start() {
	http.createServer(function (req, res) {	//Create a server
	
		//Always return success and plain text
		res.writeHead(200, {'Content-Type': 'text/plain'});
		
		//Determine path elements
		elements = url.parse(req.url, true).pathname.split("/");
		
		//Get rid of blank
		elements.shift();
		
		//Get request handle
		handle = elements.shift();
		
		//Ignore spurious browser requests for icons
		if (handle == "favicon.ico") {
			res.end("");
			return;
		}

		//Pass request to handler
		if (handlers !== undefined && handlers[handle] !== undefined) {
			res.end(handlers[handle](req.connection.remoteAddress, elements, url.parse(req.url, true).query));
		}
	}).listen(port);	//Attach server to a port
}

//Add a handler function
function addHandler(handle, handlerFcn) {
	handlers[handle] = handlerFcn;
}

exports.addHandler = addHandler;	
exports.start = start;