// third party modules
var request 	= require("request");
var cheerio 	= require('cheerio');
var grid 		= require('gridfs-stream');
var mongo 		= require('mongoskin');

// local modules
var settings = require('./settings.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('sitesraw');
db.bind('sites');

//db.sites.drop(function(){});

process.on('message',function(object){
	// iterate over db and calc weights
	var cursor = db.sitesraw.find({});

	var now = new Date();

	function next(){
		cursor.nextObject(handleNext);
	}

	function handleNext(err,site){
		if(err || site === null){
			return process.send('finish');
		}

		if( site.timestamp !== undefined || site.timestamp !== null ){
			site.timestamp = 0;
		}

		// min time diff to update
		if( ( now - site.timestamp ) > _MS_PER_MIN ){
			getSiteInfo(site.url,function(err,siteinfo){
				console.log(siteinfo);
				if(siteinfo){
					var update = {};
					update['$set'] = {
						lang: site.lang
					};
					for(var k in siteinfo){
						update['$set'][k] = siteinfo[k];
					}

					// collect keywords
					var keywords = {};
					var udesc_keywords 	= site.keywords;
					var title_keywords 	= splitAndClean(siteinfo.title,' ');
					var meta_keywords 	= splitAndClean(siteinfo.keywords,',');
					var host_keywords 	= splitAndClean(siteinfo.host,'.');

					// 1. create set
					addToSet(keywords,udesc_keywords,'udesc');
					addToSet(keywords,title_keywords,'title');
					addToSet(keywords,meta_keywords,'meta');
					addToSet(keywords,host_keywords,'host');

					// 2. compute weights
					for(var keyword in keywords){
						// 2.1 compute url distance
						var url_distance_weight 	= computeWordistanceDoc(site.url,keywords[keyword]);
						// 2.2 compute title distance
						var title_distance_weight 	= computeWordistanceDoc(siteinfo.title,keywords[keyword],'title');
						// 2.3 compute description distance
						var desc_distance_weight 	= computeWordistanceDoc(siteinfo.description,keywords[keyword]);
						// 2.4 compute doc distance
						var doc_distance_weight 	= computeWordistanceDoc(siteinfo.html,keywords[keyword]);

						keywords[keyword].k = keyword;
						keywords[keyword].tw = site.t_weight;
						keywords[keyword].sw = 
							        url_distance_weight
							+ 0.2 * title_distance_weight
							+ 0.01 * desc_distance_weight
							+ 0.09 * doc_distance_weight;

						// 3. clean keywords
						if(keywords[keyword].sw < 0.01){
							delete keywords[keyword];
						}
					}

					// to arr
					console.log(keywords);
					console.log(site.url);
					console.log('----');
					
					update['$set'].keywords = obj_to_arr(keywords);
					db.sites.update({ 'url': site.url }, update,{upsert:true},function(err){
						if(err){
							console.log(err);
						}
						next();
					});
				} else {
					next();		
				}
			});

			return;
		} else {
			next();
		}

	}

	next();
});


// taken from http://stackoverflow.com/questions/3224834/get-difference-between-2-dates-in-javascript
var _MS_PER_MIN = 1000 * 60;
var _MS_PER_DAY = _MS_PER_MIN * 60 * 24;

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
  // Discard the time and time-zone information.
  var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}


var MAX_HTML_LENGTH = 200;

function clean(str){
	if(str !== null && str !== undefined){
		str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"");
		str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"");
		//str = str.replace(/<(?:.|\s)*?>/g, "");
		//str = str.replace(/[()?:!.,;{}\"]+/g,"");
		//str = str.replace(/[ ]{2,}/g," ");
		str = str.toLowerCase();

		// check length
		if(str.length > MAX_HTML_LENGTH){
			var substr = str.substring(0,MAX_HTML_LENGTH);
			for(var i=substr.length; i<str.length; i++){
				if(str[i] === ' '){
					break;
				}
				substr += str[i];
			}
			return substr;
		}
		return str;
	} else {
		return "";
	}
}
function isEmpty(e){
	return (e === undefined || e === null || (typeof(e) === "string" && e.length == 0));
}
function getSiteInfo(shortUrl,callback) {
    request({ url: shortUrl, followAllRedirects: true },
        function (error, response, body) {
        	var site;

        	if (!error && response.statusCode == 200) {
        		$ = cheerio.load(body, {
				    ignoreWhitespace: true,
				    xmlMode: true
				});

				var title  = $('title').text();
				var description = $('meta[name=description]').attr("content");
				if(description === undefined){
					description = $('property[name=description]').attr("content");
				}
				var keywords = $('meta[name=keywords]').attr("content");
				var favicon = $('link[rel=icon]').attr("href");

   				
				site = {
					title: title,
					description: description,
					keywords: keywords,
					url: response.request.href,
					favicon: favicon,
					html: $('html').html(),//clean($('body').html()),
					host: response.request.host,
					timestamp: new Date()
				};
			
				if(isEmpty(site.title)) delete site.title;
				if(isEmpty(site.description)) delete site.description;
				if(isEmpty(site.keywords)) delete site.keywords;
				if(isEmpty(site.html)) delete site.html;
				if(isEmpty(site.title)) delete site.title;
				if(isEmpty(site.favicon)) delete site.favicon;
	        }
	        if(callback!==undefined){
	        	callback(error,site);
	    	}
        },{
			normalizeWhitespace: true
        });
}

//
function split(str,delim){
	if(isEmpty(str)){
		return [];
	} else {
		return str.split(delim);
	}
}

function splitAndClean(str,delim){
	var splitted = split(str,delim);
	for(var i=0; i<splitted.length; i++){
		splitted[i] = clean_word(splitted[i]);
	}
	return splitted;
}

function clean_url(str){
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

function clean_word(str){
	var str =  clean_url(str);
	return str.replace(/[()?:!.,;{}\"\[\]]+/g,"");
	//return str.replace(/^°!\"§$%&\/()=?`*'#+´-.,_:;<>“/gi,"");
	return str.replace(/[^[~0-9a-z`´ _"]{2,}|(\w[']\w*)]/gi,"").replace("\"","").replace("“","").replace(".","");
}

//
function computeKeywordsURLWeight(url,keywords){
	var result = {
		total_matches: 0,
		keywords: []
	};

	for(var i=0; i<keywords.length; i++){
		var word = keywords[i].toLowerCase().trim();
		word = clean_word(word);
		if(word.length > 1){
			var idx = url.indexOf(word);
			if( idx !== -1 ){
				result.total_matches++;
				result.keywords.push({
					k: word,
					w: 1.0 - ( idx / url.length )
				});
			}
		}
	}

	return result;
}

function computeWordistanceDoc(doc,keyword,type){
	if(isEmpty(doc) || keyword.type === type){
		return 0.0;
	}

	var idx = doc.indexOf(keyword.k);
	if( idx !== -1 ){
		return 1.0 - ( idx / doc.length );
	} else {
		return 0.0;
	}
}

function addToSet(set,arr,type){
	if(isEmpty(arr)){
		return;
	}
	for(var i=0; i<arr.length; i++){
		var obj = arr[i];
		var splitted = splitAndClean(obj,' ');
		if(splitted.length>1){
			addToSet(set,splitted);
		} else {
			if(!isEmpty(obj) && obj.length>1){
				var cleaned = clean_word(obj);
				if(!set[cleaned]){
					set[cleaned] = {
						k: cleaned,
						type: type
					};
				} else if( set[cleaned].type !== type ){
					set[cleaned] = {
						k: cleaned,
						type: ''
					};
				}
			}
		}
	}
	
}

function obj_to_arr(obj){
	var arr = [];
	for(var k in obj){
		arr.push(obj[k]);
	}
	return arr;
}
