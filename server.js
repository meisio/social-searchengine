var express	 = require('express');
var cp		 = require('child_process');
var mongo 	 = require('mongoskin');

var settings = require('./modules/settings.js');

var app = express();
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('words');

// create a child which runs in the background and collects twitter data
var twitter_crawler		= cp.fork('./modules/twitter_crawler.js');
var twitter_analysis	= cp.fork('./modules/twitter_analysis.js');
var site_crawler		= cp.fork('./modules/site_crawler.js');
var keyword_persistence	= cp.fork('./modules/keyword_persistence.js');

// restart twitter crawler if the child process terminates
twitter_crawler.on('message',function(msg){
	setTimeout(function(){
		twitter_crawler.send('start');
	},1000);
});

// restart twitter analysis if the child process terminates
twitter_analysis.on('message',function(msg){
	setTimeout(function(){
		twitter_analysis.send('start');
	},1000);
});

// restart site crawler if the child process terminates
site_crawler.on('message',function(msg){
	setTimeout(function(){
		site_crawler.send('start');
	},1000);
});

keyword_persistence.on('message',function(msg){
	setTimeout(function(){
		keyword_persistence.send('start');
	},1000);
});

// start the instance
//twitter_crawler.send('start');
//twitter_analysis.send('start');
//site_crawler.send('start');
//keyword_persistence.send('start');

// set port
app.set('port', (process.env.PORT || 8080));
// set public dir
app.use(express.static(__dirname + '/public'));
// set route to index
app.get('/', function(req,res) {
	res.sendFile('./public/index.html');
});
// search
app.get('/search', function(req, res, next) {
	var s = req.param("s");

	var searchterms = [];
	if(s){
		s = s.trim();
		searchterms = s.split(' ');
		/*for(var i = searchterms.length - 1; i >= 0; i--) {
			if(searchterms[i]){
				searchterms[i] = searchterms[i].trim();
				if(searchterms[i] === ''){
					searchterms = searchterms.splice(i,1);
				}
			}
		}*/
	}

	if(searchterms.length>1){
		var search = "(";
		for(var i=0; i<searchterms.length; i++){
			searchterms[i] = searchterms[i].trim();
			if(searchterms[i].length === 0){
				continue;
			}

			search += searchterms[i];
			if(i<searchterms.length-1){
				search[i] += "|";
			}
			var flag = '';
			if(searchterms[i].length>2){
				flag = 'i';
			}
			//searchterms[i] = new RegExp(".*"+searchterms[i]+".*",flag);
		}
		search += ")";
		search_regex = new RegExp(search,'gi');
	} else {
		search_regex = new RegExp("^"+s,"i");
	}

	console.log('searchterms: ' + searchterms);
	
	db.words.aggregate(
	    {$match:{name:{"$in":[search_regex]}}},
	    {$unwind : "$sites" },
	    {$group : { 
	        _id: "$sites.url",
	        weight: { $first: "$sites.weight" },
	        //tw: { $sum: [{$multiply: [ "$sites.weight", "$sites.tw" ]},1.0] },
	        tw: { $sum: { $multiply: [ "$sites.weight", "$sites.tw" ] } },
	        description: { $first: '$sites.description' },
	        title: { $first: '$sites.title' },
	        //date: { $first: '$site.site.date' },
	        //type: { $first: '$site.site.type' },
	        favicon: { $first: '$sites.favicon' }
	    }},
	    {$match:{"weight":{"$gte":0.0}}},
	    //{$match:{"description":{"$ne":null}}},
	    {$sort:{tw:-1}},
	    {$skip:0},
		{$limit:10},
		function(e, results){
			if (e) return next(e);
			res.send(results)
	});
});

// listen
app.listen(app.get('port'), function(){
	console.log('Started social based search engine server. Web Server: http://127.0.0.1:' + app.get('port'));
});