/**
 * This module transforms the twitter data which we can handle better.
 */ 

// third party modules
var mongo 	= require('mongoskin');
var cp		= require('child_process');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
// max inserts
var BULK_MAX = 64;

var col_users  = null;
var col_tweets = null;
var col_retweets = null;

var bulk_users;
var bulk_tweets;
var bulk_retweets;

var bulk_users_cnt  = 0;
var bulk_tweets_cnt = 0;
var bulk_retweets_cnt = 0;


// get collections for users
db.collection('users',function(err,collection) {
	col_users = collection;
	col_users.ensureIndex({id:1},function(){});
	bulk_users = col_users.initializeUnorderedBulkOp();
});

// get collections for tweets
db.collection('tweets',function(err,collection) {
	col_tweets = collection;
	col_tweets.ensureIndex({id:1},function(){});
	bulk_tweets = col_tweets.initializeUnorderedBulkOp();
});

// get collections for retweets
db.collection('retweets',function(err,collection) {
	col_retweets = collection;
	col_retweets.ensureIndex({id:1},function(){});
	bulk_retweets = col_retweets.initializeUnorderedBulkOp();
});

// This method inserts a new user or if the user exits it updates the users properties such as friends_count.
function insertUser(user,cb){
	if( user ){
		bulk_users.find({'id':user.id}).upsert().updateOne(user);
		bulk_users_cnt++;

		if ( bulk_users_cnt % BULK_MAX === 0 ){
	        bulk_users.execute(function(err,result) {
				bulk_users = col_users.initializeUnorderedBulkOp(); // reset after execute
	        	if(err){ console.log(err); }
		        cb();
	        });

	        return;
	    }
	}

	cb();
}

// This method inserts a new tweet or if the tweet exits it updates the tweet properties such as retweet_count.
function insertTweet(tweet,cb){
	if( tweet ){
		// tweets can also be updated. e.g. if the retweet counter inc/dec. 
		bulk_tweets.find({'id':tweet.id}).upsert().updateOne(tweet);
		bulk_tweets_cnt++;

		if ( bulk_tweets_cnt % BULK_MAX === 0 ){
	        bulk_tweets.execute(function(err,result) {
		        bulk_tweets = col_tweets.initializeUnorderedBulkOp(); // reset after execute
		        if(err){ console.log(err); }
		        cb();
	        });

	        return;
	    }
	}

	cb();
}

// This method inserts a new retweet or if the tweet exits it updates the tweet properties such as retweet_count.
function insertRetweet(retweet,cb){
	if( retweet ){
		bulk_retweets.insert(retweet);
		bulk_retweets_cnt++;

		if ( bulk_retweets_cnt % BULK_MAX === 0 ){
	        bulk_retweets.execute(function(err,result) {
		        bulk_retweets = col_retweets.initializeUnorderedBulkOp(); // reset after execute
		        if(err){ console.log(err); }
		        cb();
	        });

	        return;
	    }
	}

	cb();
}

process.on('message',function(object){
	insertTweet(object.tweet,function(){});
	insertUser(object.tweet_user,function(){});
	if(object.retweet){
		//insertRetweet(object.retweet,function(){});
		insertUser(object.retweet_user,function(){});
	}
});