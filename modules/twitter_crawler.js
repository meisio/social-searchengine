// thrid parties modules
var mongo 	= require('mongoskin');
var twit 	= require('twit');

// local modules
var settings = require('./settings.js');

// create an instance of twit
var T = new twit(settings.getTwitterAuth());

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
// bind status collection to store the raw 'tweets'
db.bind('status');

// create an instance to the stream listener
var stream = T.stream('statuses/filter',{
	// twitter does not send the main tweet if we listen only to the location such as
	// locations: '-180,-90,180,90'
	// so let listen us to 'retweets', we recieves also the original tweets
	track: ['RT']
});

// some data structure for bulk insert
var statuses = [];
var counter  = 0;
var max_ops	 = 100;

process.on('message',function(msg){
	// check which message we recieved either to start or to stop the crawler
	if(msg == 'start'){
		stream.on('tweet',function(status){
			statuses.push(status);
			counter++;

			// insert if we rechead max_ops
			if(counter % max_ops == 0){
				// get the n elements
				var s = statuses.slice(0,counter);
				// remove the first n elements from array
				statuses.splice(0,counter);

				// bulk insert
				db.status.insert(s,function(err){
					if(err){
						console.log("Failed to bulk insert status");
					}
					s = null;
				});

				// just to be sure if async processes overlapps
				counter  = statuses.length;
			}

		});
	} else if(msg == 'end'){
		// TODO: stop
	} else {
		console.log('Twitter crawler recieved an unknown message: ' + msg);
	}
});