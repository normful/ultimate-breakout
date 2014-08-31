// ;(function () {

  var game = new Phaser.Game(GAME_WIDTH, GAME_HEIGHT, Phaser.AUTO, 'breakout', { preload: preload, create: create, update: update });
  var GAME_WIDTH = 800;
  var GAME_HEIGHT = 600;

  var background;

  var bricks;
  var BRICK_ROWS = 4;
  var BRICK_COLS = 15;
  var BRICK_START_X = 120;
  var BRICK_START_Y = 100;
  var BRICK_SPACING_X = 36;
  var BRICK_SPACING_Y = 52;

  var paddle;
  var PADDLE_Y = 500;
  var PADDLE_WIDTH = 48;

  var ball;
  var ballOnPaddle = true;
  var BALL_WIDTH = 16;
  var BALL_HEIGHT = 16;
  var BALL_RELEASE_VELOCITY_X = -75;
  var BALL_RELEASE_VELOCITY_Y = -300;
  var BALL_VELOCITY_MULTIPLIER_X = 10;

  var score = 0;
  var lives = 3;
  var scoreText;
  var livesText;
  var infoText;
  var TEXT_Y = 550;

  var socket;
  var remotePlayers = {};

  function preload() {
    console.log('preload invoked');
    game.load.atlas('breakout', '/assets/breakout.png', '/assets/breakout.json');
    game.load.image('starfield', '/assets/starfield.jpg');
  }

  function create() {
    console.log('create invoked');

    // Prevent game from pausing when browser tab loses focus
    game.stage.disableVisibilityChange = true;

    game.physics.startSystem(Phaser.Physics.ARCADE);

    background = game.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'starfield');

    // Check bounds collisions on all walls except bottom
    game.physics.arcade.checkCollision.down = false;

    createBricks();
    createLocalPaddle();
    createLocalBall();
    createText();

    game.input.onDown.add(releaseBall, this);

    socket = io.connect(window.location.hostname);
    attachSocketHandlers();
  }

  function createBricks() {
    console.log('createBricks invoked');
    bricks = game.add.group();
    bricks.enableBody = true;
    bricks.physicsBodyType = Phaser.Physics.ARCADE;

    var brick;
    var brickCount = 0;

    for (var row = 0; row < BRICK_ROWS; row++) {
      for (var col = 0; col < BRICK_COLS; col++) {
        brick = bricks.create(
          BRICK_START_X + (col * BRICK_SPACING_X),
          BRICK_START_Y + (row * BRICK_SPACING_Y),
          'breakout',
          'brick_' + (row + 1) + '_1.png'
        );
        brick.body.bounce.set(1);
        brick.body.immovable = true;
        brick.brickIndex = brickCount++;
      }
    }
  }

  function createLocalPaddle() {
    console.log('createLocalPaddle invoked');
    paddle = game.add.sprite(game.world.centerX, PADDLE_Y, 'breakout', 'paddle_big.png');
    paddle.anchor.setTo(0.5, 0.5);

    game.physics.enable(paddle, Phaser.Physics.ARCADE);

    paddle.body.collideWorldBounds = true;
    paddle.body.bounce.set(1);
    paddle.body.immovable = true;
  }

  function createLocalBall() {
    console.log('createLocalBall invoked');
    ball = game.add.sprite(game.world.centerX, PADDLE_Y - BALL_HEIGHT, 'breakout', 'ball_1.png');
    ball.anchor.set(0.5);
    ball.checkWorldBounds = true;

    game.physics.enable(ball, Phaser.Physics.ARCADE);

    ball.body.collideWorldBounds = true;
    ball.body.bounce.set(1);

    ball.animations.add('spin', [ 'ball_1.png', 'ball_2.png', 'ball_3.png', 'ball_4.png', 'ball_5.png' ], 50, true, false);

    ball.events.onOutOfBounds.add(ballLost, this);
  }

  function releaseRemoteBall(data) {
    console.log('releaseRemoteBall invoked');

    //Creating a remoteball
    var remoteBall = game.add.sprite(data.posX, PADDLE_Y - BALL_HEIGHT, 'breakout', 'ball_1.png');
    remoteBall.anchor.set(0.5);
    remoteBall.checkWorldBounds = true;
    game.physics.enable(remoteBall, Phaser.Physics.ARCADE);
    remoteBall.body.collideWorldBounds = true;
    remoteBall.body.bounce.set(1);
    remoteBall.animations.add('spin', [ 'ball_1.png', 'ball_2.png', 'ball_3.png', 'ball_4.png', 'ball_5.png' ], 50, true, false);
    remoteBall.animations.play('spin');

    remoteBall.body.x = data.posX;
    remoteBall.body.velocity.x = data.exitVelocityX;
    remoteBall.body.velocity.y = data.exitVelocityY;

    remotePlayers[data.remotePlayerID]["remotePlayerBall"] = remoteBall;
    // ball.events.onOutOfBounds.add(ballLost, this);
  }

  function createText() {
    console.log('createText invoked');
    scoreText = game.add.text(32, TEXT_Y, 'score: 0',
      { font: '20px Arial', fill: '#ffffff', align: 'left' });
    livesText = game.add.text(GAME_WIDTH - 120, TEXT_Y, 'lives: 3',
      { font: '20px Arial', fill: '#ffffff', align: 'left' });
    infoText = game.add.text(game.world.centerX, GAME_HEIGHT * (2 / 3), 'Click to start',
      { font: '40px Arial', fill: '#ffffff', align: 'center' });
    infoText.anchor.setTo(0.5, 0.5);
  }

  function attachSocketHandlers() {
    console.log('attachSocketHandlers invoked');
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('new player', onNewPlayer);
    socket.on('remove player', onRemovePlayer);
    socket.on('initial bricks', onInitialBricks);
    socket.on('brick kill to other clients', onBrickKillToOtherClients);
    socket.on('paddle release ball', onPaddleReleaseBall);
    socket.on('ball hit paddle', onBallHitPaddle);
    socket.on('existing ball', onExistingBall);
    socket.on('kill remote ball', onKillRemoteBall);
  }

  function onKillRemoteBall(data) {
    console.log('onKillRemoteBall invoked');

    remotePlayers[data.remotePlayerID]["remotePlayerBall"].kill();
  }

  function onExistingBall(data) {
    console.log('onExistingBall invoked');
    //Creating a remoteball

    var b = remotePlayers[data.remotePlayerID]["remotePlayerBall"];

    if (typeof b === "undefined") {
      var remoteBall = game.add.sprite(data.posX, data.posY, 'breakout', 'ball_1.png');
      remoteBall.anchor.set(0.5);
      remoteBall.checkWorldBounds = true;
      game.physics.enable(remoteBall, Phaser.Physics.ARCADE);
      remoteBall.body.collideWorldBounds = true;
      remoteBall.body.bounce.set(1);
      remoteBall.animations.add('spin', [ 'ball_1.png', 'ball_2.png', 'ball_3.png', 'ball_4.png', 'ball_5.png' ], 50, true, false);
      remoteBall.animations.play('spin');

      remoteBall.body.velocity.x = data.velocityX;
      remoteBall.body.velocity.y = data.velocityY;

      remotePlayers[data.remotePlayerID]["remotePlayerBall"] = remoteBall;
    }
  }

  function onBallHitPaddle(data) {
    // Identify remote player's ball and change its velocity accordingly
    var b = remotePlayers[data.remotePlayerID]["remotePlayerBall"];
    b.body.velocity.x = data.exitVelocityX;
    b.body.velocity.y = data.exitVelocityY;
  }

  function onPaddleReleaseBall(data) {
    console.log("received message that other client has released ball");
    releaseRemoteBall(data);
  }

  function onSocketConnect() {
    console.log('onSocketConnect invoked');
    console.log('emitting "new player" message with existingBricks = ' + bricksString(bricks));
    socket.emit('new player', { existingBricks: bricksString(bricks) });
  }

  function onSocketDisconnect() {
    console.log('onSocketDisconnect invoked');
  }

  function onNewPlayer(data) {

    // Notify new player of client's ball position and velocity, but only do so if player hasn't released ball

    if (!ballOnPaddle) {
      socket.emit('existing ball', {
        velocityX: ball.body.velocity.x,
        velocityY: ball.body.velocity.y,
        posX: ball.body.position.x,
        posY: ball.body.position.y
      });
    }

    // Commented out due to errors with Converting circular structure to JSON
    console.log('onNewPlayer invoked. data = ' + JSON.stringify(data));
    remotePlayers[data.id] = { score: data.score };
    // console.log(data.id + ' added to remotePlayers: ' + JSON.stringify(remotePlayers));
  }

  // function onRemovePlayer(data) {
  //   if (delete remotePlayers[data.id]) {
  //     console.log(data.id + ' removed from remotePlayers: ' + JSON.stringify(remotePlayers));
  //   } else {
  //     console.log(data.id + ' not found in remotePlayers');
  //   }
  // }

  function onRemovePlayer(data) {  remotePlayers[data.id].remotePlayerBall.parent.removeChild(remotePlayers[data.id].remotePlayerBall);
    var newRemotePlayers = {};

    for (var i in remotePlayers) {
      if (i != data.id) {
        newRemotePlayers[i] = remotePlayers[i];
      }
    }

    remotePlayers = newRemotePlayers;
  }

  function onInitialBricks(data) {
    console.log('onInitialBricks invoked. data = ' + JSON.stringify(data));
    var i;
    for (var row = 0; row < BRICK_ROWS; row++) {
      for (var col = 0; col < BRICK_COLS; col++) {
        i = row * BRICK_COLS + col;
        if (data.initialBricks.charAt(i) === "0") {
          bricks.children[i].kill();
        }
      }
    }
  }

  function onBrickKillToOtherClients(data) {
    // console.log('onBrickKillToOtherClients invoked');

    // Change the velocity of the remote ball
    if (typeof remotePlayers[data.remotePlayerID] != "undefined") {
      var b = remotePlayers[data.remotePlayerID]["remotePlayerBall"];
      b.body.velocity.x = data.exitVelocityX;
      b.body.velocity.y = data.exitVelocityY;
    }

    bricks.children[data.brickIndex].kill();
  }

  function update() {
    paddle.body.x = game.input.x - 0.5 * PADDLE_WIDTH;

    if (paddle.body.x < 0) {
      paddle.body.x = 0;
    } else if (paddle.body.x > game.width - PADDLE_WIDTH) {
      paddle.body.x = game.width - PADDLE_WIDTH;
    }

    if (ballOnPaddle) {
      ball.body.x = paddle.body.x + 0.5 * PADDLE_WIDTH - 0.5 * BALL_WIDTH;
    } else {
      game.physics.arcade.collide(ball, paddle, ballHitPaddle, null, this);
      game.physics.arcade.collide(ball, bricks, ballHitBrick, null, this);
    }

    if (bricks.countLiving() === 0) {
      startNewRound();
    }
  }

  function releaseBall() {
    if (ballOnPaddle) {
      ballOnPaddle = false;
      ball.body.velocity.x = BALL_RELEASE_VELOCITY_X * ( Math.random() * 4 - 1 );
      ball.body.velocity.y = BALL_RELEASE_VELOCITY_Y;
      ball.animations.play('spin');
      infoText.visible = false;

      // Tell other clients of the release of ball
      socket.emit('paddle release ball', {
        exitVelocityX: ball.body.velocity.x,
        exitVelocityY: ball.body.velocity.y,
        posX: ball.body.x,
      });
    }
  }

  function ballLost() {
    socket.emit('kill remote ball');

    lives--;
    livesText.text = 'lives: ' + lives;
    if (lives === 0) {
      gameOver();
    } else {
      putBallOnPaddle();
    }
  }

  function putBallOnPaddle() {
    ballOnPaddle = true;
    ball.reset(paddle.body.x + 0.5 * PADDLE_WIDTH - 0.5 * BALL_WIDTH, PADDLE_Y - BALL_HEIGHT);
    ball.animations.stop();
  }

  function startNewRound() {
    socket.emit('kill remote ball');

    console.log('startNewRound invoked');
    bricks.callAll('revive');
    if (lives !==0 ) {
      putBallOnPaddle();
      score += 1000;
      scoreText.text = 'score: ' + score;
      infoText.text = 'Next Round';
    }
  }

  function gameOver() {
    ball.body.velocity.setTo(0, 0);

    infoText.text = 'Game Over!';
    infoText.visible = true;
  }

  function ballHitBrick(_ball, _brick) {
    socket.emit('brick kill from client', {
      brickIndex: _brick.brickIndex,
      exitVelocityX: ball.body.velocity.x,
      exitVelocityY: ball.body.velocity.y
    });

    _brick.kill();

    score += 10;
    scoreText.text = 'score: ' + score;
  }

  function ballHitPaddle(_ball, _paddle) {
    var diff = 0;

    if (_ball.body.x < _paddle.body.x) {
      //  Ball is on the left-hand side of the paddle
      diff = _paddle.body.x - _ball.body.x;
      _ball.body.velocity.x = (BALL_VELOCITY_MULTIPLIER_X * diff * -1);
    } else if (_ball.body.x > _paddle.body.x) {
      //  Ball is on the right-hand side of the paddle
      diff = _ball.body.x -_paddle.body.x;
      _ball.body.velocity.x = (BALL_VELOCITY_MULTIPLIER_X * diff);
    } else {
      //  Ball is perfectly in the middle
      //  Add a little random X to stop it bouncing straight up!
      _ball.body.velocity.x = BALL_VELOCITY_MULTIPLIER_X * 0.2 + Math.random() * BALL_VELOCITY_MULTIPLIER_X * 0.8;
    }

    socket.emit('ball hit paddle', {
      exitVelocityX: _ball.body.velocity.x,
      exitVelocityY: _ball.body.velocity.y
    });
  }

  function bricksString(bricksGroup) {
    var i;
    var length = bricksGroup.children.length;
    var result = "";
    for (i = 0; i < length; i++) {
      if (bricksGroup.children[i].alive) {
        result += "1";
      } else {
        result += "0";
      }
    }
    return result;
  }

// }());
