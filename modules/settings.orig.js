
exports.getMongoHost = function(){
	// url to mongodb e.g. mongodb://localhost:27017/DBNAME
	return "mongodb://localhost:27017/sesn";
}

exports.getTwitterAuth = function(){
	// twitter auth infos
	return {
	    consumer_key:         'YOUR_KEY'
	  , consumer_secret:      'YOUR_KEY'
	  , access_token:         'YOUR_KEY'
	  , access_token_secret:  'YOUR_KEY'
	};
	
}