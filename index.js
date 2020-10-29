var parseEnv=env_string=>Object.fromEntries(env_string.split(/\r\n|\r|\n/g).filter(l=>l.match(/[^ =]+=[^ =]+/)).map(l=>l.split("=")));
var fs  = require("fs");
var env = parseEnv(fs.readFileSync("./.env", "utf8"));

var WebSocket = require('ws');
var {parse:parseQueryString} = require('query-string');
var ws = new WebSocket.Server({
	port: 10016,
	verifyClient: onAuth
});

var conncount = 0;
ws.on('connection', function (cws, req){
	var clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log(`[main] ${clientIp}: New connection with ${req.url}`);
	
	/*var number = conncount++;
	console.log(`New connection #${number} from ${req.connection.remoteAddress} with ${req.url}`);
	cws.on('close', function(){
		console.log(`Closing connection from ${req.connection.remoteAddress}`);
	});*/

	var querystring = req.url.substr(1);
	if (!querystring) return cws.close();
	var params = parseQueryString(querystring);
	var target = params.target;
	if (!target) return cws.close();
	var headers = {};
	for (let key in params) if (key != "target") headers[key] = params[key];

	try {
		var tws = new WebSocket(target, {headers});
	} catch(e) {
		console.error(e);
		cws.close();
		return;
	}

	// client to target
	var messageBuffer = [];
	tws.on('open', function(){
		for (let message of messageBuffer) tws.send(message);
		messageBuffer = undefined;
	});
	cws.on('message', function(message){
		if (tws.readyState == WebSocket.OPEN) tws.send(message);
		else if (messageBuffer) messageBuffer.push(message);
	});
	cws.on('close', function(){
		tws.close();
		messageBuffer = undefined;
	});
	cws.on('error', (e) => {
		console.error(`[client-ws] ${clientIp}: ${e.toString()}`);
	});

	// target to client
	tws.on('message', function(message){
		if (cws.readyState == WebSocket.OPEN) cws.send(message);
	});
	tws.on('close', function(){
		cws.close();
	});
	tws.on('error', (e) => {
		console.error(`[target-ws] ${clientIp}: ${e.toString()}`);
	});
});

//setInterval(() => console.clear(), 500);

function onAuth(info, cb) {
	var pass = info.req.headers.password;
	if (!pass || !(pass === env.pass)) cb(false, 401, 'Unauthorized');
	cb(true);
}

/*process.on('uncaughtException', (err) => {
	console.log("UnhandledException: " + err);
});*/

undefined;
