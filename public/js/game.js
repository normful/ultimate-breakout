//;(function () {

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

  var remotePaddles;

  var ball;
  var ballOnPaddle = true;
  var BALL_WIDTH = 16;
  var BALL_HEIGHT = 16;
  var BALL_RELEASE_VELOCITY_X = -60;
  var BALL_RELEASE_VELOCITY_Y = -240;
  var BALL_VELOCITY_MULTIPLIER_X = 8;

  var score = 0;
  var lives = 3;
  var scoreText;
  var livesText;
  var infoText;
  var TEXT_Y = 550;

  var socket;
  var localPlayerName;
  var localPlayerID;
  var localPlayerColor;
  var remotePlayers = {};
  var SET_INTERVAL_DELAY = 50;
  var currentClient;

  var $leaderboard = $("#leaderboard-table-body");

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

    createRemotePaddles();
    createBricks();
    createLocalPaddle();
    createLocalBall();
    createText();

    game.input.onDown.add(releaseBall, this);

    initializeMixItUp();

    socket = io.connect(window.location.hostname);
    attachSocketHandlers();

    $('#breakout').on("mousemove", function mouseMoveHandler(event) {
      socket.emit("update paddle position", {
        x: game.input.x - 0.5 * PADDLE_WIDTH
      });
    });

    setInterval(function() {
      socket.emit('update ball', {
        x: ball.body.x,
        y: ball.body.y
      });
    }, SET_INTERVAL_DELAY);
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
    paddle.tint = localPlayerColor;
  }

  // create group for remote paddles
  function createRemotePaddles() {
    console.log('createRemotePaddles invoked');
    remotePaddles = game.add.group();
    remotePaddles.enableBody = true;
    remotePaddles.physicsBodyType = Phaser.Physics.ARCADE;
  }

  // add sprite for remote paddle and associate it with the player
  function createRemotePaddle(data){
    console.log('createRemotePaddle invoked');
    var player = data.id;

    if (typeof remotePlayers[player].paddle !== "object"){

      remotePlayers[player].paddle = remotePaddles.create(
            game.world.centerX,
            PADDLE_Y,
            'breakout',
            'paddle_big.png'
          );

      remotePlayers[player].paddle.anchor.setTo(0.5, 0.5);
      game.physics.enable(remotePlayers[player].paddle, Phaser.Physics.ARCADE);
      remotePlayers[player].paddle.body.collideWorldBounds = true;
      remotePlayers[player].paddle.body.bounce.set(1);
      remotePlayers[player].paddle.body.immovable = true;
      remotePlayers[player].paddle.name = player;
      remotePlayers[player].paddle.tint = data.color;
    }
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
    ball.tint = localPlayerColor;
  }

  function onUpdateRemoteBall(data) {
    if (typeof remotePlayers[data.id] !== "undefined") {
      if (typeof remotePlayers[data.id].remotePlayerBall !== "undefined") {
        remotePlayers[data.id].remotePlayerBall.x = data.x;
        remotePlayers[data.id].remotePlayerBall.y = data.y;
      }
    }
  }

  function createRemoteBall(data) {
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

    remotePlayers[data.remotePlayerID]["remotePlayerBall"].tint = remotePlayers[data.remotePlayerID].color;
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

  function initializeMixItUp() {
    $(function(){
      $leaderboard.mixItUp({
        selectors: {
          target: "tr"
        },
        layout: {
          display: 'block'
        }
      });
    });
  }

  function attachSocketHandlers() {
    console.log('attachSocketHandlers invoked');
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('new player', onNewRemotePlayer);
    socket.on('local player', onLocalPlayer);
    socket.on('remove player', onRemovePlayer);
    socket.on('update paddle position', onUpdatePaddlePosition);
    socket.on('initial bricks', onInitialBricks);
    socket.on('brick kill to other clients', onBrickKillToOtherClients);
    socket.on('paddle release ball', onRemotePaddleReleaseBall);
    socket.on('ball hit paddle', onRemoteBallHitPaddle);
    socket.on('existing ball', onRemoteExistingBall);
    socket.on('kill remote ball', onKillRemoteBall);
    socket.on('update ball', onUpdateRemoteBall);
    socket.on('update local score', onUpdateLocalScore);
    socket.on('update remote score', onUpdateRemoteScore);
  }

  function onKillRemoteBall(data) {
    console.log('onKillRemoteBall invoked');
    var remotePlayer;
    var remotePlayerBall;

    remotePlayer = remotePlayers[data.remotePlayerID];

    if (typeof remotePlayer !== 'undefined') {
      remotePlayerBall = remotePlayer.remotePlayerBall;
    }
    if (typeof remotePlayerBall !== 'undefined') {
      remotePlayerBall.kill();
    }
  }

  function onRemoteExistingBall(data) {
    console.log('onRemoteExistingBall invoked');
    if (typeof remotePlayers[data.remotePlayerID].remotePlayerBall === "undefined") {
      createRemoteBall(data);
    }
  }

  function onRemoteBallHitPaddle(data) {
    console.log('onPaddleHitBall invoked');
    var remotePlayer = remotePlayers[data.remotePlayerID];
    var remoteBall = remotePlayer.remotePlayerBall;
    if (typeof remotePlayer !== "undefined" && typeof remoteBall !== "undefined") {
      remoteBall.body.velocity.x = data.exitVelocityX;
      remoteBall.body.velocity.y = data.exitVelocityY;
    }
  }

  function onRemotePaddleReleaseBall(data) {
    console.log('onRemotePaddleReleaseBall invoked');
    createRemoteBall(data);
  }

  function onSocketConnect() {
    console.log('onSocketConnect invoked');
    console.log('emitting "new player" message with existingBricks = ' + bricksString(bricks));
    socket.emit('new player', { existingBricks: bricksString(bricks) });
  }

  function onSocketDisconnect() {
    console.log('onSocketDisconnect invoked');
  }

  function onNewRemotePlayer(data) {
    console.log('onNewRemotePlayer invoked');

    remotePlayers[data.id] = {
      name: data.name,
      score: data.score,
      color: data.color,
      paddleX: game.world.centerX
    };
    addPlayerToLeaderboard(data);

    createRemotePaddle(data);

    // Notify new player of client's ball position and velocity, but only do so if player hasn't released ball
    if (!ballOnPaddle) {
      socket.emit('existing ball', {
        velocityX: ball.body.velocity.x,
        velocityY: ball.body.velocity.y,
        posX: ball.body.position.x,
        posY: ball.body.position.y
      });
    }
  }

  function onLocalPlayer(data) {
    localPlayerID = data.id;
    localPlayerName = data.name;
    localPlayerColor = data.color;
    addPlayerToLeaderboard(data);

    paddle.tint = localPlayerColor;
    ball.tint = localPlayerColor;
  }

  function addPlayerToLeaderboard(message) {
    var playerScore;
    var playerColor = "#" + message.color.replace(/^0x/, "");
    var $tr;
    var $tdScore;
    var $tdName;
    var $color;

    debugger

    if (message.hasOwnProperty('score')) {
      // remote player
      playerScore = message.score;
    } else {
      // local player
      playerScore = score;
      message.name += " (You)";
    }

    $color = $('<span></span>');
    $color.css({ background : playerColor, height: '15px', width: '15px', display: 'inline-block', 'margin-right': '5px', 'border-radius' : '50%' });

    $tr = $('<tr></tr>');
    $tr.attr('data-score', playerScore);
    $tr.attr('data-id', message.id);
    $tdScore = $('<td></td>').text(playerScore);
    $tdName = $('<td></td>').text(message.name);

    $tr.append($tdScore).append($tdName).appendTo($leaderboard);

    $tdName.prepend($color);

  }

  function onRemovePlayer(data) {
    console.log('onRemovePlayer invoked');

    var remotePlayerBall = remotePlayers[data.id].remotePlayerBall;
    if (typeof remotePlayerBall !== "undefined") {
      remotePlayerBall.kill();
    }

    var remotePlayerPaddle = remotePlayers[data.id].paddle;
    if (typeof remotePlayerPaddle !== "undefined") {
      remotePlayerPaddle.kill();
    }

    var newRemotePlayers = {};
    for (var id in remotePlayers) {
      if (id !== data.id) {
        newRemotePlayers[id] = remotePlayers[id];
      }
    }
    remotePlayers = newRemotePlayers;
  }

  function onInitialBricks(data) {
    console.log('onInitialBricks invoked.');
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
    bricks.children[data.brickIndex].kill();

    var remotePlayer;
    var remotePlayerBall;

    remotePlayer = remotePlayers[data.remotePlayerID];

    if (typeof remotePlayer !== 'undefined') {
      remotePlayerBall = remotePlayer.remotePlayerBall;
    }

    if (typeof remotePlayerBall !== 'undefined' ) {
      remotePlayerBall.body.velocity.x = data.exitVelocityX;
      remotePlayerBall.body.velocity.y = data.exitVelocityY;
    }
  }

  function onUpdateLocalScore(data) {
    console.log('onLocalRemoteScore invoked');
    score = data.score;
    scoreText.text = 'score: ' + score;
    updateLeaderboard(data);
  }

  function onUpdateRemoteScore(data) {
    console.log('onUpdateRemoteScore invoked');
    remotePlayers[data.id].score = data.score;
    updateLeaderboard(data);
  }

  function updateLeaderboard(message) {
    var $tr = $leaderboard.find("[data-id='" + message.id + "']");
    $tr.attr('data-score', message.score);

    var $tdScore = $tr.children().first();
    $tdScore.text(message.score);

    $leaderboard.mixItUp('sort', 'score:desc');
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

    if (!$.isEmptyObject(remotePlayers)) {
      updatePaddlePositions();
    };
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
        velocityX: ball.body.velocity.x,
        velocityY: ball.body.velocity.y,
        posX: ball.body.x,
        posY: ball.body.y
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
      velocityX: ball.body.velocity.x,
      velocityY: ball.body.velocity.y
    });

    _brick.kill();
  }

  function ballHitPaddle(_ball, _paddle) {
    var ballCenter = _ball.body.x + BALL_WIDTH / 2;
    var paddleCenter = _paddle.body.x + PADDLE_WIDTH / 2;
    var diff;

    if (ballCenter < paddleCenter) {
      diff = paddleCenter - ballCenter;
      _ball.body.velocity.x = (BALL_VELOCITY_MULTIPLIER_X * diff * -1);
    } else if (ballCenter > paddleCenter) {
      diff = ballCenter - paddleCenter;
      _ball.body.velocity.x = (BALL_VELOCITY_MULTIPLIER_X * diff);
    } else {
      _ball.body.velocity.x = BALL_VELOCITY_MULTIPLIER_X * 0.2 + Math.random() * BALL_VELOCITY_MULTIPLIER_X * 0.8;
    }

    socket.emit('ball hit paddle', {
      velocityX: _ball.body.velocity.x,
      velocityY: _ball.body.velocity.y
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

  function getCurrentPlayerId(data) {
    currentClient = data.id;
  }

  function onUpdatePaddlePosition(data) {
    var player = data.id;
    if (remotePlayers[player] != undefined){
      remotePlayers[player].paddleX = data.x;
    }
  }

  function updatePaddlePositions() {
    $.each(remotePlayers, function(key, val){
      if (val.paddle != undefined) {
        val.paddle.body.x = val.paddleX;
      }
    });
  };

//}());
