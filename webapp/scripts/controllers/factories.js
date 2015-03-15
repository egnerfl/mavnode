angular.module('mavlink').factory('socket', ['$rootScope', function($rootScope) {
	var factory = {};
	factory.socket = io.connect();

	factory.socket.on('message', function(data) {
		$rootScope.$emit('updateData', data);
	});

	return factory;
}]);