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

// create new collection
db.bind('tweets');
db.bind('users');

// drop user db
db.users.drop(function(){});

// data strucutre for bulk insert
var bulk = {
	users: [],
	user_counter: 0,
	tweets: [],
	tweet_counter: 0,
	max: 100
};

// get cursor to the first object
var cursor = db.status.find({});
// iterate
cursor.nextObject(function(err, status) {
	
	function inner(status){
		var tweet,
			tweet_user,
			retweet,
			retweet_user;

		if(status.retweeted_status){
			// retweet
			retweet = status;
			retweet_user = status.user;
			// tweet
			tweet = status.retweeted_status;
			tweet_user = status.retweeted_status.user;

			// remove pointers
			retweet.retweeted_status = null;
			retweet.user = retweet_user.id_str;
		} else {
			// tweet
			tweet = status;
			tweet_user = status.user;
		}

		// remove tweet pointer
		tweet.user = tweet_user.id_str;

		insertUser(tweet_user,tweet.created_at,function(){
			insertUser(retweet_user,tweet.created_at,function(){
				cursor.nextObject(function(err, status) {
					inner(status);
				});
			});
		});
		
	}

	inner(status);

});


function toTimeSeries(timestamp,obj,key){
	var value = obj[key];
	obj[key] = {};
	obj[key][timestamp] = value;
	return value;
}

function toStringObj(k1,k2){
	return k1 + '.' + k2;
}

/**
 * This method inserts a new user or if the user exits it updates the users properties such as friends_count.
 */
function insertUser(user,timestamp,cb){
	if( user === undefined || user === null || cb === undefined ){
		return cb();
	}

	// clean
	cleanEmptyEntities(user);
	// clean
	cleanEntities(user,user_entities_to_remove);
	// extract permanent entities
	var timed_entities = cleanEntities(user,user_entities_permanent,true);
	timed_entities.timestamp = timestamp;
	user.timed = [];
	user.timed.push(timed_entities);

	// currently we store a timestamp series in our documents.
	// TODO: Store only diff
	db.users.findOne({'id_str':user.id_str},function(err,db_user){
		if(err){

		} else {
			if(!db_user){
				// empty insert
				db.users.insert(user,function(err){
					if(err){
					} else {
					}
				});
			} else {
				var timestamp_exists = false;
				for(var i=0; i<db_user.timed.length; i++){
					if( db_user.timed[i].timestamp === timed_entities.timestamp ){
						timestamp_exists = true;
						break;
					}
				}

				if(!timestamp_exists){
					db.users.update(
						{ 'id_str':user.id_str },
						{ '$push':{
							timed: timed_entities
						  }
						},
						{upsert:true},
						function(err){

						}
					);
				}
			}
		}

		cb();
	});

}

/**
 * This method inserts a new tweet or if the tweet exits it updates the tweet properties such as retweet_count.
 */
function insertTweet(tweet){
	if( tweet === undefined ){
		return;
	}
}

/**
 * HELPER 
 * STUFF
 */

var user_entities_permanent = ['id_str','screen_name','created_at','utc_offset','time_zone'];
var user_entities_to_remove = ['id','following','follow_request_sent','notifications'];

function contains(arr,key){
	for(var i=0; i<arr.length; i++){
		if(arr[i] === key){
			return true;
		}
	}	
	return false;
}

function cleanEntities(object,entities,other){
	var o = {};
	if(other){
		for(var entity in object){
			if(!contains(entities,entity)){
				o[entity] = object[entity];
				delete object[entity];
			}
		}
	} else {
		for(var i=0; i< entities.length; i++){
			var entity = entities[i];

			if(object[entity]){
				o[entity] = object[entity];
				delete object[entity];
			}
		}
	}
	return o;
}

function diffEntities(o1,o2){
	var o = {};
	
	for(var entity in o2){
		if(entity === 'timestamp'){
			continue;
		}

		if(o1[entity] !== o2[entity]){
			o[entity] = o2[entity];
		}
	}

	return o;
}

function size_of_o(obj){
	var c = 0;
	for(var e in obj){
		c++;
	}
	return c;
}

function cleanEmptyEntities(obj){
	for(var e in obj){
		if(obj[e] === undefined || obj[e] === null || obj[e] === '' || isNaN(obj[e])){
			delete obj[e];
		}
	}
}
