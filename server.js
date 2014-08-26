var express = require('express');
var app = express();

// Uncomment to see Express debugging
// app.use(express.logger());

/*
 * HTTP code
 */

app.set('port', (process.env.PORT || 9000));

app.listen(app.get('port'), function() {
  'use strict';
  console.log('HTTP: listening on port ' + app.get('port'));
});

app.use('/', express.static(__dirname + '/public'));

/*
 * Socket.IO code
 */

var io = require('socket.io').listen(9001);
var util = require('util');
var Player = require("./Player").Player;
var Bricks = require("./Bricks").Bricks;

var players = [];
var bricks;

io.on('connection', onSocketConnection);

function onSocketConnection(client) {
  if (players.length === 0) {
    bricks = new Bricks();
  }

  util.log(client.id + ' connected');
  client.on('disconnect', onClientDisconnect);
  client.on('new player', onNewPlayer);

  // TODO
  // client.on('move player', onMovePlayer);
}

function onClientDisconnect() {
  util.log(this.id + ' disconnected');

  var removePlayer = playerById(this.id);

  // Player not found
  if (!removePlayer) {
    util.log(this.id + ' not found in players array');
    return;
  }

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1);

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', {id: this.id});
  util.log(this.id + ' removed from players array');
}

function onNewPlayer(data) {
  util.log(this.id + ' sent "new player" message');

  var newPlayer = new Player(data.paddleX, data.ballX, data.ballY);
  newPlayer.id = this.id;

  // Broadcast new player to all socket clients except this new one
  this.broadcast.emit('new player', {
    id: newPlayer.id,
    paddleX: newPlayer.getPaddleX(),
    ballX: newPlayer.getBallX(),
    ballY: newPlayer.getBallY()
  });

  // Send existing players to the new player
  var i, existingPlayer;
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i];
    this.emit('new player', {
      id: existingPlayer.id,
      paddleX: existingPlayer.getPaddleX(),
      ballX: existingPlayer.getBallX(),
      ballY: existingPlayer.getBallY()
    });
  }

  this.emit('initial bricks', {
    initialBricks: bricks.getBricks()
  });

  // Add new player to the players array
  players.push(newPlayer);
  util.log(this.id + ' added to players array');
}

function playerById(id) {
  var i;
  for (i = 0; i < players.length; i++) {
    if (players[i].id === id) {
      return players[i];
    }
  }
  return false;
}
