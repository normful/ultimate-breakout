(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

//global variables
window.onload = function () {
  var game = new Phaser.Game(800, 600, Phaser.AUTO, 'breakout');
  var socket = io.connect('http://localhost:9001');
  var remotePlayers = [];
  var bricks;

  socket.on('connect', function onSocketConnected() {
    console.log('Connected to socket server');
    socket.emit('new player', {
      paddleX: 400,
      ballX: 400,
      ballY: 491
    });
  });

  socket.on('disconnect', function onSocketDisconnect() {
    console.log('Disconnected from socket server');
  });

  socket.on('new player', function onNewPlayer(data) {
    var newPlayer = new Player(data.paddleX, data.ballX, data.ballY);
    newPlayer.id = data.id;
    remotePlayers.push(newPlayer);
    console.log('New Player ' + newPlayer.id + ' added to remotePlayers array');
  });

  function playerById(id) {
    var i;
    for (i = 0; i < remotePlayers.length; i++) {
      if (remotePlayers[i].id == id) {
	return remotePlayers[i];
      }
    }
    return false;
  }

  // Player removed message received
  socket.on('remove player', function onRemovePlayer(data) {
    var removePlayer = playerById(data.id);

    // Player not found
    if (!removePlayer) {
      console.log('Player ' + data.id + ' not found in remotePlayers array');
      return;
    };

    remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);
    console.log('Player ' + data.id + ' removed from remotePlayers array');
  });



  // TODO: Player move message received
  // socket.on('move player', onMovePlayer);

  // Game States
  game.state.add('boot', require('./states/boot'));
  game.state.add('gameover', require('./states/gameover'));
  game.state.add('menu', require('./states/menu'));
  game.state.add('play', require('./states/play'));
  game.state.add('preload', require('./states/preload'));
  

  game.state.start('boot', true, false, socket, remotePlayers, bricks);
};

},{"./states/boot":2,"./states/gameover":3,"./states/menu":4,"./states/play":5,"./states/preload":6}],2:[function(require,module,exports){

'use strict';

function Boot() {
}

Boot.prototype = {
  init: function(socket, remotePlayers, bricks) {
    this.socket = socket;
    this.remotePlayers = remotePlayers;
    this.bricks = bricks;
  },
  preload: function() {
    this.load.image('preloader', 'assets/preloader.gif');
  },
  create: function() {
    this.game.input.maxPointers = 1;
    this.game.state.start('preload', true, false, this.socket, this.remotePlayers, this.bricks);
  }
};

module.exports = Boot;

},{}],3:[function(require,module,exports){

'use strict';
function GameOver() {}

GameOver.prototype = {
  init: function(socket, remotePlayers, bricks) {
    this.socket = socket;
    this.remotePlayers = remotePlayers;
    this.bricks = bricks;
  },
  preload: function () {

  },
  create: function () {

    var style = { font: '65px Arial', fill: '#ffffff', align: 'center'};
    this.titleText = this.game.add.text(this.game.world.centerX,100, 'Game Over!', style);
    this.titleText.anchor.setTo(0.5, 0.5);

    this.instructionText = this.game.add.text(this.game.world.centerX, 300, 'Click To Play Again', { font: '16px Arial', fill: '#ffffff', align: 'center'});
    this.instructionText.anchor.setTo(0.5, 0.5);
  },
  update: function () {
    if(this.game.input.activePointer.justPressed()) {
      this.game.state.start('play', true, false, this.socket, this.remotePlayers, this.bricks);
      // this.game.state.start('play', true, false, this.socket, this.remotePlayers, this.bricks);
    }
  }
};
module.exports = GameOver;

},{}],4:[function(require,module,exports){

'use strict';
function Menu() {}

Menu.prototype = {
  init: function(socket, remotePlayers, bricks) {
    this.socket = socket;
    this.remotePlayers = remotePlayers;
    this.bricks = bricks;
  },
  preload: function() {

  },
  create: function() {
    this.instructionsText = this.game.add.text(this.game.world.centerX, 200, 'Click anywhere to play!', { font: '36px Arial', fill: '#ffffff', align: 'center'});
    this.instructionsText.anchor.setTo(0.5, 0.5);

  },
  update: function() {
    if(this.game.input.activePointer.justPressed()) {
      this.game.state.start('play', true, false, this.socket, this.remotePlayers, this.bricks);
    }
  }
};

module.exports = Menu;

},{}],5:[function(require,module,exports){

  var score = 0;
  var scoreText;
  var ballOnPaddle = true;

  'use strict';
  function Play() {}
  Play.prototype = {
    init: function(socket, remotePlayers, bricks) {
      this.socket = socket;
      this.remotePlayers = remotePlayers;
      this.bricks = bricks;
    },
    preload: function() {
      this.game.load.audio('rick', 'assets/rickroll.mp3');
    },
    create: function() {
      // just testing out music ;)
      this.music = this.game.add.audio('rick');
      this.music.play();

      this.game.physics.startSystem(Phaser.Physics.ARCADE);
      this.game.physics.arcade.checkCollision.down = false;

      this.socket.on('initial bricks', function onInitialBricks(data) {
        console.log('"initial bricks" message received from server');
        this.bricks = data.initialBricks;
      });

      var numRow = 4; // bricks.length
      var numCol = 17; // bricks[0].length

      //bricksGroup
      this.bricksGroup = this.game.add.group();
      this.bricksGroup.enableBody = true;

      for (var row = 0; row < numRow; row++) {
        for (var col = 0; col < numCol; col++) {
          this.brick = this.bricksGroup.create(100 + col*36, 100 + row*40, 'brick');
          this.brick.body.immovable = true;

          // Kill the brick if it is dead in the initial bricks
          if (this.bricks.getBricks()[row][column] === 0) {
            this.brick.kill();
          }
        }
      }

      this.paddle = this.game.add.sprite(this.game.world.centerX, 500, 'paddle');
      this.paddle.anchor.setTo(0.5, 0.5);
      this.game.physics.arcade.enable(this.paddle);
      this.paddle.body.immovable = true;

      this.ball = this.game.add.sprite(this.game.world.centerX, this.paddle.y - 9, 'ball');
      this.ball.anchor.setTo(0.5);
      this.ball.checkWorldBounds = true;
      this.game.physics.arcade.enable(this.ball);

      scoreText = this.game.add.text(16, 16, 'score: 0', { fontSize: '12px', fill: '#FFF' });

      this.game.input.onDown.add(releaseBall, this);
      this.ball.events.onOutOfBounds.add(gameOver, this);
    },
    update: function() {
      this.paddle.body.x = this.game.input.x;

      if (this.paddle.x > this.game.width - 12){
        this.paddle.x = this.game.width - 12;
      }
      if (ballOnPaddle){
        this.ball.body.x = this.paddle.x;
      } else {
        this.game.physics.arcade.collide(this.paddle, this.ball, ballHitPaddle, null, this);
        this.game.physics.arcade.collide(this.ball, this.bricksGroup, ballHitBrick, null, this);
      }

    }
  };

  function ballHitBrick (ball, brick) {
    brick.kill();

    score += 10;
    scoreText.text = 'Score: ' + score;
  }

  function ballHitPaddle (ball, paddle) {
      var diff = 0;

      if (this.ball.x < this.paddle.x)
      {
          //  Ball is on the left-hand side of the paddle
          diff = this.paddle.x - this.ball.x;
          this.ball.body.velocity.x = (-5 * diff);
      }
      else if (this.ball.x > this.paddle.x)
      {
          //  Ball is on the right-hand side of the paddle
          diff = this.ball.x -this.paddle.x;
          this.ball.body.velocity.x = (5 * diff);
      }
      else
      {
          //  Ball is perfectly in the middle
          //  Add a little random X to stop it bouncing straight up!
          this.ball.body.velocity.x = 2 + Math.random() * 4;
      }
  }

  function releaseBall() {

    if (ballOnPaddle) {
      ballOnPaddle = false;
      this.ball.body.velocity.x = 100;
      this.ball.body.velocity.y = -200;
      this.ball.body.bounce.set(1);
      this.ball.body.collideWorldBounds = true;
    }
  }

  function gameOver() {
    ballOnPaddle = true;
    this.music.stop();
    this.game.state.start('gameover');
  }

  module.exports = Play;

},{}],6:[function(require,module,exports){

'use strict';
function Preload() {
  this.asset = null;
  this.ready = false;
}

Preload.prototype = {
  init: function(socket, remotePlayers, bricks) {
    this.socket = socket;
    this.remotePlayers = remotePlayers;
    this.bricks = bricks;
  },
  preload: function() {

    // load all game assets
    this.asset = this.add.sprite(this.width/2,this.height/2, 'preloader');
    this.asset.anchor.setTo(0.5, 0.5);

    this.load.onLoadComplete.addOnce(this.onLoadComplete, this);
    this.load.setPreloadSprite(this.asset);
    this.load.image('ball', 'assets/ball.png');
    this.load.image('paddle', 'assets/paddle.png');
    this.load.image('brick', 'assets/brick.png');

  },
  create: function() {
    this.asset.cropEnabled = false;
  },
  update: function() {
    if(!!this.ready) {
      // uncomment to go to menu
      this.game.state.start('menu', true, false, this.socket, this.remotePlayers, this.bricks);
      // this.game.state.start('play', true, false, this.socket, this.remotePlayers, this.bricks);
    }
  },
  onLoadComplete: function() {
    this.ready = true;
  }
};

module.exports = Preload;

},{}]},{},[1])