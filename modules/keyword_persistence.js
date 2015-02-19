var mongo 		= require('mongoskin');

// local modules
var settings = require('./settings.js');
var utils = require('./utils.js');

// create an instance to mongo
var db = mongo.db(settings.getMongoHost(), {native_parser: true});
db.bind('sites');
db.bind('words');

db.words.drop(function(){});

var iter = 0;

process.on('message',function(msg){
	// iterate over sites and update keywords
	iter++;
	console.log('keyword persistence iter-' + iter);
	var cursor = db.sites.find({});
	
	function next(){
		cursor.nextObject(handleNext);
	}
	
	function handleNext(err,site){
		

		if(err || site === null){
			if(err){
				console.log(err);
			}
			return process.send('finish');
		}

		var clean_html = utils.cleanHtml(site.html);

		function nextWord(i,site){

			if(i >= site.keywords.length){
				next();
			} else {
				db.words.findOne({'name':site.keywords[i].k},function(err,word){
					var txt = utils.getTextSurrounding(site.keywords[i].k,clean_html);
					if(err){
						console.log(err);
						nextWord(i+1,site);
					} else {

						var site_entry = {
							url: site.url,
							title: site.title,
							description: site.description,
							html: txt,
							tw: site.keywords[i].tw,
							sw: site.keywords[i].sw,
							weight: site.keywords[i].tw * site.keywords[i].sw
						};
						
						if(!word){
							// create new word
							word = {
								name: site.keywords[i].k,
								sites: [site_entry]
							};

							db.words.insert(word,function(err){
								if(err){
									console.log(err);
								}
								nextWord(i+1,site);
							});
						} else {

							// update
							var t_weight_max = site.keywords[i].tw;
							var t_weight_min = site.keywords[i].tw;
							var s_weight_max = site.keywords[i].sw;
							var s_weight_min = site.keywords[i].sw;

							var w_sum = 0.0;

							var contains = false;
							var word_sites = {};
							for(var j=0; j<word.sites.length; j++){
								word_sites[word.sites[j].url] = {};
								if(site_entry.url === word.sites[j].url){
									word.sites[j] = site_entry;
									contains = true;
								}

								if(t_weight_max < word.sites[j].tw){
									t_weight_max = word.sites[j].tw;
								}
								if(t_weight_min > word.sites[j].tw){
									t_weight_min = word.sites[j].tw;
								}
								if(s_weight_max < word.sites[j].sw){
									s_weight_max = word.sites[j].sw;
								}
								if(s_weight_min > word.sites[j].sw){
									s_weight_min = word.sites[j].sw;
								}
							}

							if(!contains){
								// insert new site
								word.sites.push(site_entry);
							}

							// normalize weights
							var w_sum = 0.0;
							for(var j=0; j<word.sites.length; j++){
								var tw = (word.sites[j].tw - 0.0) / (t_weight_max - t_weight_min + 1.0);
								var sw = (word.sites[j].sw - 0.0) / (s_weight_max - s_weight_min + 1.0);
								word.sites[j].weight = tw * sw;
								w_sum += word.sites[j].weight;
							}

							// normalize to 1.0
							
							for(var j=0; j<word.sites.length; j++){
								word.sites[j].weight /= w_sum;
							}

							db.words.update({'name':word.name},{'$set':{'sites':word.sites}},function(err){
								if(err){
									console.log(err);
								}
								nextWord(i+1,site);
							});					
						}
					}
				});
			}

		}

		nextWord(0,site);
	
	}

	next();
});