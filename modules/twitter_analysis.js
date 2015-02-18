// third partie modules
var mongo 	= require('mongoskin');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('users');
db.bind('tweets');
db.bind('weights');
db.weights.drop(function(){});

// update the users weight
function computeUserWeight(user){
	var oldWeight = user.weight;
	if(isNaN(oldWeight)){
		oldWeight = 0.0;
	}

	// add +1 to avoid divison by zero
	var a = user.followers_count + 1;
	var b = user.friends_count	 + 1;
	var c = user.listed_count 	 + 1;

	// TODO: Normalization
	user.weight = 
		  Math.log( a / b )	// followers / friends ratio
		+ Math.log( c );	// log of listed count
	console.log(user);
	// avg. weight
	user.weight = ( user.weight + oldWeight ) * 0.5;
	
}

function computeTweetWeight(user,tweet){
	var oldWeight = tweet.weight;
	if(isNaN(oldWeight)){
		oldWeight = 0.0;
	}

	var a = user.followers_count + 1;
	var d = tweet.retweet_count	 + 1;
	var c = user.statuses_count  + 1;

	// lets keep it simple for the first time
	tweet.weight = 
		  user.weight
		+ Math.log( d / c ); // retweet / tweet ratio

	console.log('Tweet weight ' + tweet.weight);
}

// TODO: Remove URLs, symbols etc from text
function getCleanText(text){
	return text;
}

process.on('message',function(object){
	// iterate over db and calc weights
	// get cursor to the first object
	var cursor = db.tweets.find({});

	function next(){
		cursor.nextObject(handleNext);
	}

	function handleNext(err,tweet){
		if(err ||tweet === null){
			return process.send('finish');
		}

		// at this part we filter out those tweets without urls or media urls
		if(		tweet.entities.urls.length === 0 
			|| (tweet.extended_entities === undefined || tweet.extended_entities === null) 
			|| (tweet.extended_entities.media.length === 0)){
			return next();
		}

		db.users.findOne({'id':tweet.user},function(err,db_user){
			if(err || db_user === null){
				return next();
			}

			var update = {};
			update['$set'] = {
				'followers_count': 	db_user.followers_count,
				'favourites_count': db_user.favourites_count,
				'statuses_count': 	db_user.statuses_count,
				'friends_count': 	db_user.friends_count,
				'listed_count': 	db_user.listed_count,
				'protected': 		db_user.protected,
				'verified': 		db_user.verified,
				'geo_enabled': 		db_user.geo_enabled,
				'user_location': 	db_user.location,
				'is_translator': 	db_user.is_translator,
				'user_created_at': 	db_user.created_at,
				'user_description': db_user.description,
				'user_url': 		db_user.url,
				'user_lang': 		db_user.lang,
				'retweet_count': 	tweet.retweet_count,
				'favorite_count': 	tweet.favorite_count,
				'tweet_text': 		tweet.text,
				'tweet_lang': 		tweet.lang,
				'tweet_place': 		tweet.place
			};

			// multiple adds:
			// { $addToSet: { tags: { $each: [ "camera", "electronics", "accessories" ] } } }
			update['$addToSet'] = {};

			var tmp_arr = [];
			
			// put urls inside
			if(tweet.entities.urls.length > 0){
				for(var i=0; i<tweet.entities.urls.length; i++){
					tmp_arr.push(tweet.entities.urls[i].expanded_url);
				}
			}

			// crete update statement
			update['$addToSet']['site_urls'] = { '$each' : tmp_arr };

			// reset and add media urls
			tmp_arr = [];

			// put medias inside
			if(	   tweet.extended_entities !== undefined 
				&& tweet.extended_entities !== null 
				&& tweet.extended_entities.media.length > 0 ){
				for(var i=0; i<tweet.extended_entities.media.length; i++){
					tmp_arr.push(tweet.extended_entities.media[i].media_url);
				}

				// crete update statement
				update['$addToSet']['media_urls'] = { '$each' : tmp_arr };
			}

			db.weights.update({'tweet_id':tweet.id,'user_id':db_user.id},update,{upsert:true},function(err){
				if(err){
					console.log('failed to update weight... tweet:' + tweet.id + ' user:' + user.id);
				}

				next();
			});
			
		})
	}
	
	next();
	// TODO: calc weights from retweets
});