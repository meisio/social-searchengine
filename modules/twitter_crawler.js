// thrid party modules
var mongo 	= require('mongoskin');
var twit 	= require('twit');
var cp		= require('child_process');

// local modules
var settings 			= require('./settings.js');
var twitter_persistence	= cp.fork('./modules/twitter_persistence.js');

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
	track: ['http']
});

// split twitter data
function handleStatus(status){
	var tweet, tweet_user, retweet, retweet_user;

	// check if it is a tweet or retweet
	if(status.retweeted_status){
		// retweet
		retweet = status;
		retweet_user = status.user;
		// tweet
		tweet = status.retweeted_status;
		tweet_user = status.retweeted_status.user;
		// clean twitter id
		setTwitterId(retweet);
		setTwitterId(retweet_user);
		// clean twitter id
		setTwitterId(tweet);
		// remove pointers
		retweet.retweeted_status = tweet.id;
		retweet.user = retweet_user.id;
		// clean empty fields
		cleanFields(retweet);
		cleanFields(retweet_user);
	} else {
		// tweet
		tweet = status;
		tweet_user = status.user;
		// clean twitter id
		setTwitterId(tweet);
	}

	setTwitterId(tweet_user);
	
	// remove tweet pointer
	tweet.user = tweet_user.id;

	// clean empty fields
	cleanFields(tweet);
	cleanFields(tweet_user);

	return {
		tweet: tweet,
		tweet_user: tweet_user,
		retweet: retweet,
		retweet_user: retweet_user
	};
}

// helper function to set id
function setTwitterId(object){
	// TODO: nodejs or mongo driver converts a long to double.
	object.id = object.id_str
	delete object.id_str;
}

// helper function to clean empty fields
function cleanFields(obj){
	for(var e in obj){
		if(obj[e] === undefined || obj[e] === null || obj[e] === ''){
			delete obj[e];
		} else if (typeof obj[e] == 'string' || obj[e] instanceof String){
			obj[e] = obj[e].toLowerCase();
		}
	}
}

process.on('message',function(msg){
	// check which message we recieved either to start or to stop the crawler
	if(msg == 'start'){
		stream.on('tweet',function(status){
			var object = handleStatus(status);
			twitter_persistence.send(object);
		});
	} else if(msg == 'end'){
		// TODO: stop
	} else {
		console.log('Twitter crawler recieved an unknown message: ' + msg);
	}
});
