
var http = require('http');
var fs = require('fs');
var socketio = require('socket.io');
var logger = require('winston');
var mongo = require('mongodb');
var program = require('commander');

var websocket;

// var mongoUri = "mongodb://10.122.33.125/sie-logs";
// var mongoCollection = "log";
// var serverPort = "8080";

var mongoUri = null;
var mongoCollection = null;
var serverPort = null;

function checkParams(){

  if (program.mongoUri != null){
    mongoUri = program.mongoUri;
  } else if(process.env.MONGO_URI != null) {
    mongoUri = process.env.MONGO_URI;
  }

  if (program.mongoCollection != null){
    mongoCollection = program.mongoCollection;
  } else if(process.env.MONGO_COLLECTION != null) {
    mongoCollection = process.env.MONGO_COLLECTION;
  }

  if (program.port != null){
    serverPort = program.port;
  } else if(process.env.PORT != null) {
    serverPort = process.env.PORT;
  }


  logger.info(mongoUri);  
  logger.info(mongoCollection);  
  logger.info(serverPort);  

  if(mongoUri && mongoCollection && serverPort)
    return true;

}

// subscriber function
var subscribe = function(){  
  var args = [].slice.call(arguments);
  var next = args.pop();
  var filter = args.shift() || {};

  //console.info(next + ' ' + filter);

  if('function' !== typeof next) throw('Callback function not defined');

 // connect to MongoDB
  mongo.MongoClient.connect("mongodb://" + mongoUri, function(err, db){
      
      if(err)
        throw('db err: ' + err);
      
   // make sure you have created capped collection "messages" on db "test"
    db.collection(mongoCollection, function(err, coll) {

      if(err)
        throw('collection err: ' + err);

     // seek to latest object
      var seekCursor = coll.find(filter).limit(1);//.sort({$natural: -1}).limit(1);
      seekCursor.nextObject(function(err, latest) {

        if(err)
          throw('seek err: ' + err);
      
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

var emitMessages = function(document){
  if(websocket){
    logger.info(document);  
    websocket.emit('message',document);
  } else {
    logger.info("nobody is listening");
  }
};

program
.version('0.0.1')
.option('-p, --port [port]', 'The HTTP port used')
.option('-m, --mongoUri [uri]', 'The MongoDB host and port like 127.0.0.1:27017')
.option('-c, --mongoCollection [collection]', 'The MongoDB collection to tail')
.parse(process.argv);
  

if(!checkParams()){
  process.exit(1);
}

subscribe(emitMessages);

var filterStream = function(q){

  console.info("filter received: " + q);
  subscribe(JSON.parse(q), emitMessages);

};

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

    websocket.on('filter',filterStream);
});

server.listen(serverPort);