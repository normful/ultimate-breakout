var express = require('express');
var app = express();
var port = process.env.PORT || 9000;

var server = require('http').Server(app);
var io = require('socket.io')(server);

var util = require('util');
var utilInspectOpts = { showHidden: false, depth: 1, colors: true };

var players = {};
var adjNoun = require('adj-noun');
adjNoun.seed(Math.floor(Math.random() * 1000));
var bricks;
var allBricks;

// Uncomment to see Express debugging
// app.use(express.logger());

var mongoose = require('mongoose');
var mongoURI =
  process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/multiplayer-breakout';

mongoose.connect(mongoURI, function (err, res) {
  if (err) {
    console.log ('ERROR connecting to: ' + mongoURI + '. ' + err);
  } else {
    console.log ('SUCCESS connecting to: ' + mongoURI);
  }
});

var playerSchema = new mongoose.Schema({
  name: String,
  score: Number
}, {collection: 'Player'});

var Player = mongoose.model('Player', playerSchema);

var lastClientRequestingHighScores;

/*
 * Socket.IO code
 */

io.on('connection', onSocketConnection);

function onSocketConnection(client) {
  util.log(client.id + ' connected');
  client.on('new player', onNewPlayer);
  client.on('disconnect', onClientDisconnect);
  client.on('update paddle position', onUpdatePaddlePosition);
  client.on('brick kill from client', onBrickKillFromClient);
  client.on('paddle release ball', onPaddleReleaseBall);
  client.on('ball hit paddle', onBallHitPaddle);
  client.on('existing ball', onExistingBall);
  client.on('kill remote ball', onKillRemoteBall);
  client.on('update ball', onUpdateBall);
  client.on('player game over', onPlayerGameOver);
  client.on('player final score', onPlayerFinalScore);
  client.on('play brick hit sound', onPlayBrickHitSound);
  client.on('monster kill', onMonsterKill);
}

function onPlayBrickHitSound(data) {
  this.broadcast.emit('play brick hit sound', data);
}

function onUpdateBall(data) {
  this.broadcast.emit('update ball', {
    x: data.x,
    y: data.y,
    id: this.id
  });
}

function onKillRemoteBall() {
  this.broadcast.emit('kill remote ball', { remotePlayerID: this.id });
}

function onExistingBall(data) {
  this.broadcast.emit('existing ball', {
    velocityX: data.velocityX,
    velocityY: data.velocityY,
    posX: data.posX,
    posY: data.posY,
    remotePlayerID: this.id
  });
}

function onBallHitPaddle(data) {
  this.broadcast.emit('ball hit paddle', {
    velocityX: data.velocityX,
    velocityY: data.velocityY,
    remotePlayerID: this.id
  });
}

function onPaddleReleaseBall(data) {
  this.broadcast.emit('paddle release ball', {
    velocityX: data.velocityX,
    velocityY: data.velocityY,
    posX: data.posX,
    posY: data.posY,
    remotePlayerID: this.id
  });
}

function onNewPlayer(data) {

  var color = '0x' + Math.floor(Math.random() * 16777215).toString(16);

  util.log(this.id + ' sent "new player" message');

  // First 'new player' message sets initial brick layout
  // This might be a reconnecting client with a partially played game
  if (isEmpty(players)) {

    bricks = data.existingBricks;
    util.log('first new player setting brick layout to: ' + bricks);

    // string of "1", repeated data.brickCount times
    allBricks = new Array(data.existingBricks.length + 1).join("1");
  }

  // Send existing players to the new player
  for (var playerID in players) {
    if (players.hasOwnProperty(playerID)) {
      util.log(this.id + ' has been sent the existing player ' + playerID);
      this.emit('new player', {
        id: playerID,
        name: players[playerID].name,
        score: players[playerID].score,
        color: players[playerID].color,
        gameOver: players[playerID].gameOver
      });
    }
  }

  // Send existing brick layout to the new player
  this.emit('initial bricks', { initialBricks: bricks });
  util.log(this.id + ' has been sent the existing brick layout: ' + bricks);

  // Assign player id and name
  var funnyName = adjNoun().join(' ');
  this.emit('local player', {
    id: this.id,
    name: funnyName,
    color: color,
    gameOver: false
  });

  // Add new player to players array
  players[this.id] = {
    color: color,
    name: funnyName,
    score: 0,
    gameOver: false
  };
  util.log(this.id + ' added to players');
  util.log('players = ' + util.inspect(players, utilInspectOpts));

  // Broadcast new player to all socket clients except this new one
  this.broadcast.emit('new player', {
    id: this.id,
    name: funnyName,
    color: color,
    score: 0,
    gameOver: false
  });
  util.log(this.id + ' broadcast to all existing players');

  lastClientRequestingHighScores = this;
  loadHighScores();
}

function onClientDisconnect() {
  util.log(this.id + ' disconnected');

  if (delete players[this.id]) {
    util.log(this.id + ' removed from players');
    util.log('players = ' + util.inspect(players, utilInspectOpts));
  } else {
    util.log(this.id + ' not found in players');
  }

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', { id: this.id });
  util.log(this.id + ' removal broadcast to existing players');

  if (isEmpty(players)) {
    resetBricks();
  }
}

function onBrickKillFromClient(data) {
  var client = this;

  util.log(client.id + ' sent "brick kill from client" message. brickIndex = ' + data.brickIndex);

  if (bricks.charAt(data.brickIndex) === "0") {
    util.log('brick ' + data.brickIndex + ' already dead. Brick kill message not broadcasted to other clients and no points rewarded to ' +  client.id);
    return;
  }

  checkForFirstBlood(client, data.brickX, data.brickY);

  bricks = bricks.slice(0, data.brickIndex) + "0" + bricks.slice(data.brickIndex + 1);

  if (bricks.indexOf("1") === -1) {
    resetBricks();
    players[client.id].score += 1000;
    client.emit('render plus 1000', {
      x: data.brickX,
      y: data.brickY
    });
    io.sockets.emit('play last brick sound', {
      randSoundNum: Math.random()
    });
  } else {
    players[client.id].score += 100;
  }

  util.log(client.id + " new score = " + players[client.id].score);

  util.log('"brick kill to other clients" message broadcast to other clients');
  client.broadcast.emit('brick kill to other clients', {
    brickIndex: data.brickIndex,
    velocityX: data.velocityX,
    velocityY: data.velocityY,
    remotePlayerID: client.id
  });

  broadcastUpdatedScore(client);
}

function checkForFirstBlood(client, brickX, brickY) {
  if (bricks.indexOf("0") === -1) {
    io.sockets.emit('first brick hit');

    players[client.id].score += 500;
    client.emit('render plus 500', {
      x: brickX,
      y: brickY
    });
  }
}

function broadcastUpdatedScore(client) {
  client.emit('update local score', {
    id: client.id,
    score: players[client.id].score
  });

  client.broadcast.emit('update remote score', {
    id: client.id,
    score: players[client.id].score
  });
}

function resetBricks() {
  util.log('All users disconnected. resetting bricks to: ' + allBricks);
  bricks = allBricks;
}

function isEmpty(obj) {
  return (Object.getOwnPropertyNames(obj).length === 0);
}

function onUpdatePaddlePosition(data) {
  this.broadcast.emit('update paddle position', {
    id: this.id,
    x: data.x
  });
}

function onMonsterKill() {
  var client = this;
  players[client.id].score += 1000;
  broadcastUpdatedScore(client);
  client.broadcast.emit('play monster kill sound');
}

function onPlayerGameOver() {
  players[this.id].gameOver = true;
  this.broadcast.emit('remote player game over', {
    id: this.id,
  });
}

function onPlayerFinalScore(data) {
  util.log('onPlayerFinalScore data.name = ' + data.name);
  util.log('onPlayerFinalScore data.score = ' + data.score);
  var clientSubmittingScore = this;

  var player = new Player({
    name: data.name,
    score: data.score
  });

  player.save(function(err, player) {
    if (err) {
      return console.log(err);
    }
    console.log('Successfully saved score: ' + util.inspect(player, utilInspectOpts));
    // reload the highscores after the player adds their score
    lastClientRequestingHighScores = clientSubmittingScore;
    loadHighScores();
  });
}

function loadHighScores() {
  util.log('loadHighScores invoked');
  Player.find({}, 'name score').sort({ score: -1 }).limit(10).exec(emitHighScores);
}

function emitHighScores(err, results) {
  util.log('emitHighScores invoked');
  util.log('results = ' + util.inspect(results, utilInspectOpts));
  lastClientRequestingHighScores.emit('high scores', { scores: results });
}

/*
 * HTTP code
 */

server.listen(port, function() {
  'use strict';
  util.log('HTTP: listening on port ' + port);
});

app.use('/', express.static(__dirname + '/public'));
