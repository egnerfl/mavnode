'use strict';

/**
 * @ngdoc function
 * @name mavlink.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the mavlink
 */
angular.module('mavlink')
	.controller('MainCtrl', ["$scope", "$rootScope", "socket", "uiGmapGoogleMapApi", function($scope, $rootScope, socket, uiGmapGoogleMapApi) {

		var localData = {};

		$rootScope.$on('updateData', function(event, data) {
			localData[data.type] = data;

			$scope.$apply(function() {
				$scope.data = localData;

				if (localData.GLOBAL_POSITION_INT) {
					var lat = $scope.parseGeo(localData.GLOBAL_POSITION_INT.message.lat);
					var lon = $scope.parseGeo(localData.GLOBAL_POSITION_INT.message.lon);

					$scope.map = {
						center: {
							latitude: lat,
							longitude: lon
						},
						zoom: 8
					};
				}
			});
		});

		window.getData = function() {
			return localData;
		}

		$scope.parseGeo = function(geo) {
			if (geo) {
				return geo.toString().substring(0, 2) + '.' + geo.toString().substring(2);
			}
		}

		$scope.parseVoltage = function(volt) {
			if (volt) {
				volt = volt.toString();

				while(volt.length < 5){
					volt = "0" + volt;
				}

				return volt.toString().substring(0, 2) + '.' + volt.toString().substring(2);
			}
		}

		$scope.parseCurrent = function(cur) {
			if (cur) {
				cur = cur.toString();

				while(cur.length < 4){
					cur = "0" + cur;
				}

				return cur.toString().substring(0, 2) + '.' + cur.toString().substring(2);
			}
		}
		

	}]);