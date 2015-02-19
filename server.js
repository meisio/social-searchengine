var express	= require('express');
var cp		= require('child_process');

var app = express();
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
twitter_crawler.send('start');
twitter_analysis.send('start');
site_crawler.send('start');
keyword_persistence.send('start');

// set port
app.set('port', (process.env.PORT || 8080));
// set public dir
app.set(express.static(__dirname + '/public'));
// set route to index
app.set('/', function(req,res) {
	res.sendFile('./public/index.html');
});
// listen
app.listen(app.get('port'), function(){
	console.log('Started social based search engine server. Web Server: http://127.0.0.1:' + app.get('port'));
});