var express	= require('express');
var cp		= require('child_process');

var app = express();
// create a child which runs in the background and collects twitter data
var tc	= cp.fork('./modules/twitter_crawler.js');

// restart twitter crawler if the child process terminates
tc.on('message',function(msg){
	tc.send('start');
});

// start the instance
tc.send('start');

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