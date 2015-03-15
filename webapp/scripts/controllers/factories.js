angular.module('mavlink').factory('socket', function() {
  var socket = io('http://localhost:3000');

  socket.on('message', function (data) {
    console.log(data);
	});

  return socket;
});