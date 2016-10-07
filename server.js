
var http = require('http');
var fs = require('fs');
var socketio = require('socket.io');
var logger = require('winston');
var mongo = require('mongodb');

var websocket;

// var mongoUri = "mongodb://10.122.33.125/sie-logs";
// var mongoCollection = "log";
// var serverPort = "8080";

var mongoUri = process.env.MONGO_URI;
var mongoCollection = process.env.MONGO_COLLECTION;
var serverPort = process.env.PORT;

function checkParams(){

  logger.info(process.env.MONGO_URI);  
  logger.info(process.env.MONGO_COLLECTION);  
  logger.info(process.env.PORT);  

  if(process.env.MONGO_URI && process.env.MONGO_COLLECTION && process.env.PORT)
    return true;

}

// subscriber function
var subscribe = function(){  
  var args = [].slice.call(arguments);
  var next = args.pop();
  var filter = args.shift() || {};

  if('function' !== typeof next) throw('Callback function not defined');

 // connect to MongoDB
  mongo.MongoClient.connect(mongoUri, function(err, db){

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

if(!checkParams()){
  process.exit(1);
}

// new documents will appear in the console
subscribe( function(document) {
  if(websocket){
    logger.info(document);  
    websocket.emit('message',document);
  } else {
    logger.info("nobody is listening");
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