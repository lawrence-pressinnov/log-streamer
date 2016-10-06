
var http = require('http');
var fs = require('fs');
var socketio = require('socket.io');
var logger = require('winston');

var websocket;

var mongoUri = "mongodb://localhost/local";
var mongoCollection = "log";
var serverPort = "8080";


// subscriber function
var subscribe = function(){  
  var args = [].slice.call(arguments);
  var next = args.pop();
  var filter = args.shift() || {};

  if('function' !== typeof next) throw('Callback function not defined');

 // connect to MongoDB
  require('mongodb').MongoClient.connect(mongoUri, function(err, db){

   // make sure you have created capped collection "messages" on db "test"
    db.collection(mongoCollection, function(err, coll) {

     // seek to latest object
      var seekCursor = coll.find(filter).limit(1);//.sort({$natural: -1}).limit(1);
      seekCursor.nextObject(function(err, latest) {
        if (latest) {
          filter._id = { $gt: latest._id }
        }

       // set MongoDB cursor options
        var cursorOptions = {
          tailable: true,
          awaitdata: true,
          numberOfRetries: -1
        };

       // create stream and listen
        var stream = coll.find(filter, cursorOptions).stream();//.sort({$natural: -1}).stream();

       // call the callback
        stream.on('data', next);
      });
    });   
  });     
};

// new documents will appear in the console
subscribe( function(document) {
  if(websocket){
    logger.debug(document);  
    websocket.emit('message',document.gnin);
  } else {
    logger.debug("nobody is listening");
  }
});

// Chargement du fichier index.html affiché au client
var server = http.createServer(function(req, res) {
    fs.readFile('./index.html', 'utf-8', function(error, content) {
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });
});

io = socketio.listen(server);

// Quand un client se connecte, on le note dans la console
io.sockets.on('connection', function (socket) {
    logger.info('Un client est connecté !');
    //enregistre la connexion ouverte avec le client
    websocket = socket;
});

server.listen(serverPort);