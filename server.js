var express = require('express');
var app = express();
var port = process.env.PORT || 9000;

var server = require('http').Server(app);
var io = require('socket.io')(server);

var util = require('util');
var utilInspectOpts = { showHidden: false, depth: 1, colors: true };

var players = {};
var bricks;
var allBricks;

// Uncomment to see Express debugging
// app.use(express.logger());

/*
 * Socket.IO code
 */

io.on('connection', onSocketConnection);

function onSocketConnection(client) {
  util.log(client.id + ' connected');
  client.on('new player', onNewPlayer);
  client.on('disconnect', onClientDisconnect);
  client.on('brick kill from client', onBrickKillFromClient);
  client.on('paddle release ball', onPaddleReleaseBall);
  client.on('ball hit paddle', onBallHitPaddle);
}

function onBallHitPaddle(data) {
  this.broadcast.emit('ball hit paddle', data);
}

function onPaddleReleaseBall(data) {
  this.broadcast.emit('paddle release ball', data);
}

function onNewPlayer(data) {
  util.log(this.id + ' sent "new player" message');

  // First 'new player' message sets initial brick layout
  // This might be a reconnecting client with a partially played game
  if (isEmpty(players)) {

    bricks = data.existingBricks;
    util.log('first new player setting brick layout to: ' + bricks)

    // string of "1", repeated data.brickCount times
    allBricks = new Array(data.existingBricks.length + 1).join("1");
  }

  // Send existing players to the new player
  for (var playerID in players) {
    if (players.hasOwnProperty(playerID)) {
      util.log(this.id + ' has been sent the existing player ' + playerID);
      this.emit('new player', {
        id: playerID,
        score: players[playerID].score
      });
    }
  }

  // Send existing brick layout to the new player
  this.emit('initial bricks', { initialBricks: bricks });
  util.log(this.id + ' has been sent the existing brick layout: ' + bricks);

  // Add new player to players array
  players[this.id] = { score: 0 };
  util.log(this.id + ' added to players');
  util.log('players = ' + util.inspect(players, utilInspectOpts));

  // Broadcast new player to all socket clients except this new one
  this.broadcast.emit('new player', {
    id: this.id,
    score: 0
  });
  util.log(this.id + ' broadcast to all existing players');
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
  // util.log(this.id + ' sent "brick kill from client" message. brickIndex = ' + data.brickIndex);
  bricks = bricks.slice(0, data.brickIndex) + "0" + bricks.slice(data.brickIndex + 1);
  // util.log('Server bricks updated: ' + bricks);
  this.broadcast.emit('brick kill to other clients', {
    brickIndex: data.brickIndex,
    exitVelocityX: data.exitVelocityX,
    exitVelocityY: data.exitVelocityY
  });
}

function resetBricks() {
  util.log('All users disconnected. resetting bricks to: ' + allBricks);
  bricks = allBricks;
}

function isEmpty(obj) {
  return (Object.getOwnPropertyNames(obj).length === 0);
}
/*
 * HTTP code
 */

server.listen(port, function() {
  'use strict';
  util.log('HTTP: listening on port ' + port);
});

app.use('/', express.static(__dirname + '/public'));
