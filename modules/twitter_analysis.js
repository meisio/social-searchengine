/**
 * The following information are saved in db:
 *	keys: 	tweet_id, user_id, url
 *	values: keywords, weights
 */

// third party modules
var mongo 	= require('mongoskin');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('users');
db.bind('tweets');
db.bind('weights');
db.bind('sitesraw');

//db.sitesraw.drop(function(){});

var col_sites;
var bulk;
// get collections for users
db.collection('sitesraw',function(err,collection) {
	col_sites = collection;
	//col_sites.ensureIndex({id:1},function(){});
	bulk = col_sites.initializeUnorderedBulkOp();
});

var natural   = require('natural');
var Trie = natural.Trie;
var tokenizer = new natural.WordTokenizer();

// update the users weight
function computeUserWeight(user){
	var oldWeight = user.weight;
	if(isNaN(oldWeight)){
		oldWeight = 0.0;
	}

	// add +1 to avoid divison by zero
	var a = user.followers_count  + 1;
	var b = user.friends_count	  + 1;
	var c = user.listed_count 	  + 1;
	var d = user.favourites_count + 1;

	// TODO: Normalization
	user.weight = 
		  1.0 - ( 1.0 / (a / b))	// followers / friends ratio
		+ 0.1 - ( 0.1 / c )			// log of listed count
		+ 0.1 - ( 0.1 / d )			// log of fav count

	// avg. weight
	user.weight = ( user.weight + oldWeight ) * 0.5;
	
	return user.weight;
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
	tweet.weight = d / c; // retweet / tweet ratio

	// console.log('Tweet weight ' + tweet.weight);
	return tweet.weight;
}

// TODO: Remove URLs, symbols etc from text
function getCleanText(text){
	return text;
}

function isEmpty(e){
	return (e === undefined || e === null);
}

//
function split(str,delim){
	if(isEmpty(str)){
		return [];
	} else {
		return str.split(delim);
	}
}

function cleanAndSplit(str,delim){
	var str_cleaned = cleanAll(str);
	return split(str,delim);
}

function getKeywordsOnly(arr){
	var res = [];
	for(var i=0; i<arr.length; i++){
		if(!isURL(arr[i]) && arr[i].length > 1){
			res.push(arr[i]);
		}
	}
	return res;
}

function clean(str){
	if(!isEmpty(str)){
		var str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"");
		str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"");
		str = str.replace(/<(?:.|\s)*?>/g, "");
		//str = str.replace(/[()?:!.,;{}\"]+/g,"");
		str = str.replace(/[ ]{2,}/g," ");
		return str.toLowerCase().trim();
	} else {
		return "";
	}
}

function cleanAll(str){
	var str =  clean(str);
	//return str.replace(/[()?:-_!.,;{}\"]+/g,"");
	//return str.replace(/^°!\"§$%&\/()=?`*'#+´-.,_:;<>“/gi,"");
	return str.replace(/[^[~0-9a-z`´ _"]{2,}|(\w[']\w*)]/gi,"").replace("\"","").replace("“","").replace("|","").replace("!","");
}

//
function computeUserUrlWeight(user){
	var result = {
		total_matches: 0,
		keywords: []
	};

	if( user.description !== undefined && user.description !== null ){
		if( user.url !== undefined && user.url !== null ){
			// split keywords
			var words = split(user.description,' ');
			for(var i=0; i<words.length; i++){
				var word = words[i].toLowerCase().trim();
				word = cleanAll(word);
				if(word.length > 1){
					var idx = user.url.indexOf(word);
					if( idx !== -1 ){
						result.total_matches++;
						result.keywords.push({
							k: word,
							w: 1.0 - ( idx / user.url.length )
						});
					}
				}
			}
		}
	}

	return result;
}

var url_pattern = new RegExp("(http|ftp|https)://[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?")

function isURL(str){
	return str.match(url_pattern);
}

function removeURLs(str){
	if(str === undefined || str === null) return '';
	return str.replace(/((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi, '');
}

function removeMails(str){
	if(str === undefined || str === null) return '';
	return str.replace(/[a-zA-Z0-9\\+\\.\\_\\%\\-]{1,256}\\@[a-zA-Z0-9][a-zA-Z0-9\\-]{0,64}(\\.[a-zA-Z0-9][a-zA-Z0-9\\-]{0,25})+/gi, '');
}

process.on('message',function(object){
	// iterate over db and calc weights
	// get cursor to the first object
	var cursor = db.tweets.find({});

	function next(){
		cursor.nextObject(handleNext);
	}

	function processNext(err,tweet){
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
			if(db_user.description !== undefined){
				// clean up
				var description = removeURLs(db_user.description);
					description = removeMails(description);
				var tweet_text 	= removeURLs(tweet.text);
					tweet_text 	= removeMails(tweet_text);
				console.log(db_user.description);
				console.log(tokenizer.tokenize(description));
				console.log(tweet.text);
				console.log(tokenizer.tokenize(tweet_text));
				console.log("===============================\n");
			}
			next();
		});
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

			var user_weight = computeUserWeight(db_user);
			var tweet_weight = computeTweetWeight(db_user,tweet);

			var t_weight = 0.6 * user_weight + 0.4 * tweet_weight;
			
			var update = {};

			var trie = new Trie();

			// clean up
			var description 		 = removeURLs(db_user.description);
				description 		 = removeMails(description);
			var description_keywords = tokenizer.tokenize(description);
			var tweet_text 		= removeURLs(tweet.text);
				tweet_text 		= removeMails(tweet_text);
			var tweet_keywords  = tokenizer.tokenize(tweet_text);

			if(!true){
				console.log(db_user.description);
				console.log(tokenizer.tokenize(description));
				console.log(tweet.text);
				console.log(tokenizer.tokenize(tweet_text));
				console.log("===============================\n");
			}

			// rethink structure
			update['$set'] = {
				'description_keywords': description_keywords,
				'tweet_keywords': tweet_keywords,
				't_weight':t_weight,
				'lang': tweet.lang
			};

			var inserted = 0;

			var urls = [];

			if(!isEmpty(db_user.url)){
				bulk.find({'user_id':db_user.id,'url':db_user.url}).upsert().update(update);
				inserted++;
			}

			if(tweet.entities.urls.length > 0){
				for(var i=0; i<tweet.entities.urls.length; i++){
					urls.push(tweet.entities.urls[i].expanded_url);
				}
			}

			for(var i=0; i<urls.length; i++){
				bulk.find({'tweet_id':tweet.id,'user_id':db_user.id,'url':urls[i]}).upsert().update(update);
			}

			inserted += urls.length;
			
			// process urls
			if(inserted > 0){	
				bulk.execute(function(err,result) {
					bulk = col_sites.initializeUnorderedBulkOp(); // reset after execute
		        	if(err){ console.log(err); }
			        next();
		        });
			} else {
				next();
			}

			/*
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
				'tweet_place': 		tweet.place,
				'user_weight': 		user_weight,
				'tweet_weight': 	tweet_weight,
				'user_url_weight':  user_url_weight
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
			*/

			/*
			db.weights.update({'tweet_id':tweet.id,'user_id':db_user.id},update,{upsert:true},function(err){
				if(err){
					console.log('failed to update weight... tweet:' + tweet.id + ' user:' + user.id);
				}

				next();
			});
			*/
			
		})
	}
	
	next();
	// TODO: calc weights from retweets
});