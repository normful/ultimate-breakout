var game = new Phaser.Game(800, 600, Phaser.AUTO, 'breakout', { preload: preload, create: create, update: update });

var background;

var ball;
var paddle;
var bricksGroup;

var socket;
var remotePlayers = [];
var bricks;

var ballOnPaddle = true;

var introText;
var scoreText;
var livesText;

var score = 0;
var lives = 3;

function preload() {
  game.load.atlas('breakout', '/assets/breakout.png', '/assets/breakout.json');
  game.load.image('starfield', '/assets/starfield.jpg');
}

function create() {
  game.physics.startSystem(Phaser.Physics.ARCADE);

  //  We check bounds collisions against all walls other than the bottom one
  game.physics.arcade.checkCollision.down = false;

  background = game.add.tileSprite(0, 0, 800, 600, 'starfield');

  bricksGroup = game.add.group();
  bricksGroup.enableBody = true;
  bricksGroup.physicsBodyType = Phaser.Physics.ARCADE;

  var brick;
  var brickCount = 0;

  for (var row = 0; row < 4; row++) {
    for (var col = 0; col < 15; col++) {
      brick = bricksGroup.create(120 + (col * 36), 100 + (row * 52), 'breakout', 'brick_' + (row + 1) + '_1.png');
      brick.body.bounce.set(1);
      brick.body.immovable = true;
      brick.row = row;
      brick.col = col;
      brick.childrenIndex = brickCount++;
    }
  }

  paddle = game.add.sprite(game.world.centerX, 500, 'breakout', 'paddle_big.png');
  paddle.anchor.setTo(0.5, 0.5);

  game.physics.enable(paddle, Phaser.Physics.ARCADE);

  paddle.body.collideWorldBounds = true;
  paddle.body.bounce.set(1);
  paddle.body.immovable = true;

  ball = game.add.sprite(game.world.centerX, paddle.y - 16, 'breakout', 'ball_1.png');
  ball.anchor.set(0.5);
  ball.checkWorldBounds = true;

  game.physics.enable(ball, Phaser.Physics.ARCADE);

  ball.body.collideWorldBounds = true;
  ball.body.bounce.set(1);

  ball.animations.add('spin', [ 'ball_1.png', 'ball_2.png', 'ball_3.png', 'ball_4.png', 'ball_5.png' ], 50, true, false);

  ball.events.onOutOfBounds.add(ballLost, this);

  scoreText = game.add.text(32, 550, 'score: 0', { font: "20px Arial", fill: "#ffffff", align: "left" });
  livesText = game.add.text(680, 550, 'lives: 3', { font: "20px Arial", fill: "#ffffff", align: "left" });
  introText = game.add.text(game.world.centerX, 400, '- click to start -', { font: "40px Arial", fill: "#ffffff", align: "center" });
  introText.anchor.setTo(0.5, 0.5);

  game.input.onDown.add(releaseBall, this);

  attachSocketHandlers();
}

function attachSocketHandlers() {

  socket = io.connect(window.location.hostname);

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
    console.log('New Player ' + newPlayer.id + ' added to remotePlayers array: ' + printRemotePlayersArray());
  });

  socket.on('remove player', function onRemovePlayer(data) {
    var removePlayer = playerById(data.id);

    // Player not found
    if (!removePlayer) {
      console.log('Player ' + data.id + ' not found in remotePlayers array');
      return;
    }

    remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);
    console.log('Player ' + data.id + ' removed from remotePlayers array: ' + printRemotePlayersArray());
  });

  socket.on('initial bricks', function onInitialBricks(data) {
    bricks = data.initialBricks;
    var killInitialBricks = function killInitialBricks() {
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 15; col++) {
          if (bricks[row][col] === 0) {
            bricksGroup.children[row * 15 + col].kill();
          }
        }
      }
    };
    if (typeof(bricksGroup) === 'undefined' ||
        typeof(bricksGroup.children) === 'undefined') {
      setTimeout(killInitialBricks, 3000);
    } else {
      killInitialBricks();
    }
  });

  socket.on('brick kill to other clients', function onBrickKillToOtherClients(data) {
    var killBricks = function killBricks() {
      bricks[data.row][data.col] = 0;
      bricksGroup.children[data.childrenIndex].kill();
    };
    if (typeof(bricks) === 'undefined' ||
        typeof(bricksGroup) === 'undefined' ||
        typeof(bricksGroup.children) === 'undefined') {
      setTimeout(killBricks, 3000);
    } else {
      killBricks();
    }
  });
}

function update () {
  paddle.x = game.input.x;

  if (paddle.x < 24) {
    paddle.x = 24;
  } else if (paddle.x > game.width - 24) {
    paddle.x = game.width - 24;
  }

  if (ballOnPaddle) {
    ball.body.x = paddle.x;
  } else {
    game.physics.arcade.collide(ball, paddle, ballHitPaddle, null, this);
    game.physics.arcade.collide(ball, bricksGroup, ballHitBrick, null, this);
  }
}

function releaseBall () {
  if (ballOnPaddle) {
    ballOnPaddle = false;
    ball.body.velocity.y = -300;
    ball.body.velocity.x = -75;
    ball.animations.play('spin');
    introText.visible = false;
  }
}

function ballLost () {
  lives--;
  livesText.text = 'lives: ' + lives;

  if (lives === 0) {
    gameOver();
  } else {
    ballOnPaddle = true;
    ball.reset(paddle.body.x + 16, paddle.y - 16);
    ball.animations.stop();
  }
}

function gameOver () {
  ball.body.velocity.setTo(0, 0);

  introText.text = 'Game Over!';
  introText.visible = true;
}

function ballHitBrick (_ball, _brick) {

  console.log('ballHitBrick:',  _brick.row, _brick.col);

  socket.emit('brick kill from client', {
    row: _brick.row,
    col: _brick.col,
    childrenIndex: _brick.childrenIndex
  });

  _brick.kill();

  score += 10;
  scoreText.text = 'score: ' + score;

  //  Are they any bricksGroup left?
  if (bricksGroup.countLiving() === 0) {
    //  New level starts
    score += 1000;
    scoreText.text = 'score: ' + score;
    introText.text = '- Next Level -';

    //  Let's move the ball back to the paddle
    ballOnPaddle = true;
    ball.body.velocity.set(0);
    ball.x = paddle.x + 16;
    ball.y = paddle.y - 16;
    ball.animations.stop();

    //  And bring the bricksGroup back from the dead :)
    bricksGroup.callAll('revive');
  }
}

function ballHitPaddle (_ball, _paddle) {
  var diff = 0;

  if (_ball.x < _paddle.x) {
    //  Ball is on the left-hand side of the paddle
    diff = _paddle.x - _ball.x;
    _ball.body.velocity.x = (-10 * diff);
  } else if (_ball.x > _paddle.x) {
    //  Ball is on the right-hand side of the paddle
    diff = _ball.x -_paddle.x;
    _ball.body.velocity.x = (10 * diff);
  } else {
    //  Ball is perfectly in the middle
    //  Add a little random X to stop it bouncing straight up!
    _ball.body.velocity.x = 2 + Math.random() * 8;
  }
}

function playerById(id) {
  var i;
  var length = remotePlayers.length;
  for (i = 0; i < length; i++) {
    if (remotePlayers[i].id === id) {
      return remotePlayers[i];
    }
  }
  return false;
}

function printRemotePlayersArray() {
  var i;
  var length = remotePlayers.length;
  var result = "[ ";
  for (i = 0; i < length; i++) {
    result += remotePlayers[i].id + " ";
  }
  return result + "]";
}
