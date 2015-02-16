/**
 * This module transforms the twitter data which we can handle better.
 */ 

// third partie modules
var mongo 	= require('mongoskin');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
// bind status collection to store the raw 'tweets'
db.bind('status');

// bind collection
db.bind('tweets');
db.bind('users');

// create index
db.tweets.ensureIndex({id:1},function(){});
db.users.ensureIndex({id:1},function(){});

// drop user db
db.users.drop(function(){});
db.tweets.drop(function(){});

var user_cache = {};

var col_users  = null;
var col_tweets = null;

var bulk_users;
var bulk_tweets;

var bulk_users_cnt  = 0;
var bulk_tweets_cnt = 0;
 
var bulk_max = 256;

// get collections for users
db.collection('users',function(err,collection) {
	col_users = collection;
	bulk_users = col_users.initializeUnorderedBulkOp();
	start();
});

// get collections for tweets
db.collection('tweets',function(err,collection) {
	col_tweets = collection;
	bulk_tweets = col_tweets.initializeUnorderedBulkOp();
	start();
});

function start(){
	if(col_users && col_tweets){
		// get cursor to the first object
		var cursor = db.status.find({});

		// iterate over cursor
		cursor.nextObject(function(err, status) {
			function inner(status){
				if(status === null){
					// finish. push last elements
					if ( bulk_users_cnt % bulk_max !== 0 ){
				        bulk_users.execute(function(err,result) {});
				    }

				    if ( bulk_tweets_cnt % bulk_max !== 0 ){
				        bulk_tweets.execute(function(err,result) {});
				    }

					return;
				}
				var tweet, tweet_user, retweet, retweet_user;

				if(status.retweeted_status){
					// retweet
					retweet = status;
					retweet_user = status.user;
					// tweet
					tweet = status.retweeted_status;
					tweet_user = status.retweeted_status.user;

					setTwitterId(retweet);
					setTwitterId(retweet_user);

					// remove pointers
					retweet.retweeted_status = null;
					retweet.user = retweet_user.id;
				} else {
					// tweet
					tweet = status;
					tweet_user = status.user;
				}


				// clean twitter id
				setTwitterId(tweet);
				setTwitterId(tweet_user);
				// remove tweet pointer
				tweet.user = tweet_user.id;

				// insert. I don't like this nested calls. Does somebody has a better idea?
				insertTweet(tweet,function(){
					insertUser(tweet_user,tweet.created_at,function(){
						if(retweet){
							// currently we are not interested in retweets just for the user.
							insertUser(retweet_user,retweet.created_at,function(){
								cursor.nextObject(function(err, status){
									inner(status);
								});
							});					
						} else {
							cursor.nextObject(function(err, status){
								inner(status);
							});
						}

					});
				});
								
			}

			inner(status);
		});
	}
}

/**
 * This method inserts a new user or if the user exits it updates the users properties such as friends_count.
 */
function insertUser(user,timestamp,cb){
	if( user === undefined || user === null ){
		return cb();
	}

	// clean
	cleanEmptyEntities(user);

	bulk_users.find({'id':user.id}).upsert().updateOne(user);
	bulk_users_cnt++;

	if ( bulk_users_cnt % bulk_max === 0 ){
        bulk_users.execute(function(err,result) {
        	if(err){
        		console.log(err);
        	}

	        bulk_users = col_users.initializeUnorderedBulkOp(); // reset after execute
	        cb();
        });
    } else {
    	cb();
    }

}

/**
 * This method inserts a new tweet or if the tweet exits it updates the tweet properties such as retweet_count.
 */
function insertTweet(tweet,cb){
	if( tweet === undefined  || tweet === null ){
		return;
	}

	// clean
	cleanEmptyEntities(tweet);

	// tweets can also be updated. e.g. if the retweet counter inc/dec. 
	bulk_tweets.find({'id':tweet.id}).upsert().updateOne(tweet);
	bulk_tweets_cnt++;

	if ( bulk_tweets_cnt % bulk_max === 0 ){
        bulk_tweets.execute(function(err,result) {
        	if(err){
        		console.log(err);
        	}

	        bulk_tweets = col_tweets.initializeUnorderedBulkOp(); // reset after execute
	        cb();
        });
    } else {
    	cb();
    }

}

function cleanEmptyEntities(obj){
	for(var e in obj){
		if(obj[e] === undefined || obj[e] === null || obj[e] === ''){
			delete obj[e];
		}
	}
}

function setTwitterId(object){
	// TODO: nodejs or mongo driver converts a long to double.
	object.id = object.id_str
	delete object.id_str;
}




process.on('message',function(type,obj){
	if(type === 'tweet'){
		insertTweet(obj);
	} else if(type === 'retweet'){
		// retweets currently not important
	} else if(type === 'user'){
		insertUser(user);
	}
});

