'use strict';

/**
 * @ngdoc overview
 * @name mavlink
 * @description
 * # mavlink
 *
 * Main module of the application.
 */
angular
	.module('mavlink', ['uiGmapgoogle-maps']).config(function(uiGmapGoogleMapApiProvider) {
		uiGmapGoogleMapApiProvider.configure({
			//    key: 'your api key',
			v: '3.17',
			libraries: 'weather,geometry,visualization'
		});
	})