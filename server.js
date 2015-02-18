var express	= require('express');
var cp		= require('child_process');

var app = express();
// create a child which runs in the background and collects twitter data
var twitter_crawler	= cp.fork('./modules/twitter_crawler.js');
var twitter_analysis	= cp.fork('./modules/twitter_analysis.js');

// restart twitter crawler if the child process terminates
twitter_crawler.on('message',function(msg){
	twitter_crawler.send('start');
});

// restart twitter analysis if the child process terminates
twitter_analysis.on('message',function(msg){
	twitter_analysis.send('start');
});

// start the instance
//twitter_crawler.send('start');
twitter_analysis.send('start');

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