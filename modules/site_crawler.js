// third partie modules
var mongo 	= require('mongoskin');
var grid = require('gridfs-stream');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('weights');

