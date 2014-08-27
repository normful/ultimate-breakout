var express = require('express');
var app = express();
var port = process.env.PORT || 9000;

var server = require('http').Server(app);
var io = require('socket.io')(server);

var util = require('util');

var players = {};
var bricks = '111111111111111' +
             '111111111111111' +
             '111111111111111' +
             '111111111111111';

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
}

function onNewPlayer() {
  util.log(this.id + ' sent "new player" message');

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
  this.emit('initial bricks', {
    initialBricks: bricks
  });
  util.log(this.id + ' has been sent the existing brick layout: ' + bricks);

  // Add new player to players array
  players[this.id] = { score: 0 };
  util.log(this.id + ' added to players object: ' +
    util.inspect(players, {showHidden: false, depth: 1, colors: true})
  );

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
    util.log(this.id + ' removed from to players object: ' +
      util.inspect(players, {showHidden: false, depth: 0, colors: true})
    );
  } else {
    util.log(this.id + ' not found in players');
  }

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', { id: this.id });
  util.log(this.id + ' removal broadcast to existing players');

  if (Object.getOwnPropertyNames(players).length === 0) {
    resetBricks();
  }
}

function onBrickKillFromClient(data) {
  util.log(
    this.id + ' sent "brick kill from client" message: ' +
    'row = ' + data.row + ' ' +
    'col = ' + data.col + ' ' +
    'childrenIndex = ' + data.childrenIndex
  );

  bricks = bricks.slice(0, data.childrenIndex) + "0" + bricks.slice(data.childrenIndex + 1);
  util.log('bricks updated: ' + bricks);

  this.broadcast.emit('brick kill to other clients', {
    row: data.row,
    col: data.col,
    childrenIndex: data.childrenIndex
  });
}

function resetBricks() {
  util.log('All users disconnected. resetBricks invoked');
  bricks = '111111111111111' +
           '111111111111111' +
           '111111111111111' +
           '111111111111111';
}

/*
 * HTTP code
 */

server.listen(port, function() {
  'use strict';
  util.log('HTTP: listening on port ' + port);
});

app.use('/', express.static(__dirname + '/public'));
