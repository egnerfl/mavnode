'use strict';

/**
 * @ngdoc function
 * @name mavlink.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the mavlink
 */
angular.module('mavlink')
	.controller('MainCtrl', ["$scope", "$rootScope", "socket", function($scope, $rootScope, socket) {

		var localData = {};


		$rootScope.$on('updateData', function(event, data) {
			localData[data.type] = data;

			$scope.$apply(function() {
				$scope.data = localData;
			});
		});


	}]);