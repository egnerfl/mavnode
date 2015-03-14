var net = require("net");

var connection = net.createConnection(12345);
connection.on("data", function(data) {

	console.log(data);

});