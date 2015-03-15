angular.module('mavlink').factory('socket', ['$rootScope', function($rootScope) {
	var factory = {};
  factory.socket = io('http://localhost:3000');

    factory.socket.on('message', function (data) {
		$rootScope.$emit('updateData', data);
	});

  return factory;
}]);