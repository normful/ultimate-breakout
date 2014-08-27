;(function () {

  var game = new Phaser.Game(GAME_WIDTH, GAME_HEIGHT, Phaser.AUTO, 'breakout', { preload: preload, create: create, update: update });
  var GAME_WIDTH = 800;
  var GAME_HEIGHT = 600;

  var background;

  var bricks;
  var BRICK_ROWS = 4;
  var BRICK_COLS = 15;
  var BRICK_START_X = 120;
  var BRICK_START_Y = 100;
  var BRICK_X_SPACING = 36;
  var BRICK_Y_SPACING = 52;

  var paddle;
  var PADDLE_Y = 500;
  var PADDLE_WIDTH = 48;
  var HALF_PADDLE_WIDTH = PADDLE_WIDTH / 2;

  var ball;
  var ballOnPaddle = true;
  var BALL_WIDTH = 16;
  var BALL_HEIGHT = 16;
  var BALL_X_RELEASE_VELOCITY = -75;
  var BALL_Y_RELEASE_VELOCITY = -300;
  var BALL_X_VELOCITY_MULTIPLIER = 10;

  var score = 0;
  var lives = 3;
  var scoreText;
  var livesText;
  var introText;
  var BOTTOM_TEXT_Y = 550;

  var socket;
  var remotePlayers = [];

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
          BRICK_START_X + (col * BRICK_X_SPACING),
          BRICK_START_Y + (row * BRICK_Y_SPACING),
          'breakout',
          'brick_' + (row + 1) + '_1.png'
        );
        brick.body.bounce.set(1);
        brick.body.immovable = true;
        brick.row = row;
        brick.col = col;
        brick.childrenIndex = brickCount++;
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

  function createText() {
    console.log('createText invoked');
    scoreText = game.add.text(32, BOTTOM_TEXT_Y, 'score: 0',
      { font: '20px Arial', fill: '#ffffff', align: 'left' });
    livesText = game.add.text(GAME_WIDTH - 120, BOTTOM_TEXT_Y, 'lives: 3',
      { font: '20px Arial', fill: '#ffffff', align: 'left' });
    introText = game.add.text(game.world.centerX, GAME_HEIGHT * (2 / 3), 'Click to start',
      { font: '40px Arial', fill: '#ffffff', align: 'center' });
    introText.anchor.setTo(0.5, 0.5);
  }

  function attachSocketHandlers() {
    console.log('attachSocketHandlers invoked');
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('new player', onNewPlayer);
    socket.on('remove player', onRemovePlayer);
    socket.on('initial bricks', onInitialBricks);
    socket.on('brick kill to other clients', onBrickKillToOtherClients);
  }

  function onSocketConnect() {
    console.log('onSocketConnect invoked');
    socket.emit('new player', {
      paddleX: GAME_WIDTH / 2,
      ballX: GAME_WIDTH / 2,
      ballY: PADDLE_Y - BALL_HEIGHT / 2
    });
  }

  function onSocketDisconnect() {
    console.log('onSocketDisconnect invoked');
  }

  function onNewPlayer(data) {
    var newPlayer = new Player(data.paddleX, data.ballX, data.ballY);
    newPlayer.id = data.id;
    remotePlayers.push(newPlayer);
    console.log(newPlayer.id + ' added to remotePlayers array: ' + printRemotePlayersArray());
  }

  function onRemovePlayer(data) {
    var playerToRemove = findPlayerById(data.id);
    if (!playerToRemove) {
      console.log(data.id + ' not found in remotePlayers array');
      return;
    }
    remotePlayers.splice(remotePlayers.indexOf(playerToRemove), 1);
    console.log(data.id + ' removed from remotePlayers array: ' + printRemotePlayersArray());
  }

  function onInitialBricks(data) {
    console.log('onInitialBricks invoked');
    var killInitialBricks = function killInitialBricks() {
      console.log('killInitialBricks invoked');
      for (var row = 0; row < BRICK_ROWS; row++) {
        for (var col = 0; col < BRICK_COLS; col++) {
          if (data.initialBricks[row][col] === 0) {
            bricks.children[row * BRICK_COLS + col].kill();
          }
        }
      }
    };
    if (typeof(bricks) === 'undefined' ||
        typeof(bricks.children) === 'undefined') {
      setTimeout(killInitialBricks, 3000);
    } else {
      killInitialBricks();
    }
  }

  function onBrickKillToOtherClients(data) {
    console.log('onBrickKillToOtherClients invoked');
    var killBricks = function killBricks() {
      console.log('killBricks invoked');
      bricks.children[data.childrenIndex].kill();
    };
    if (typeof(bricks) === 'undefined' ||
        typeof(bricks.children) === 'undefined') {
      setTimeout(killBricks, 3000);
    } else {
      killBricks();
    }
  }

  function update() {
    paddle.body.x = game.input.x;

    if (paddle.body.x < HALF_PADDLE_WIDTH) {
      paddle.body.x = HALF_PADDLE_WIDTH;
    } else if (paddle.body.x > game.width - HALF_PADDLE_WIDTH) {
      paddle.body.x = game.width - HALF_PADDLE_WIDTH;
    }

    if (ballOnPaddle) {
      ball.body.x = paddle.body.x;
    } else {
      game.physics.arcade.collide(ball, paddle, ballHitPaddle, null, this);
      game.physics.arcade.collide(ball, bricks, ballHitBrick, null, this);
    }
  }

  function releaseBall() {
    if (ballOnPaddle) {
      ballOnPaddle = false;
      ball.body.velocity.x = BALL_X_RELEASE_VELOCITY;
      ball.body.velocity.y = BALL_Y_RELEASE_VELOCITY;
      ball.animations.play('spin');
      introText.visible = false;
    }
  }

  function ballLost() {
    lives--;
    livesText.text = 'lives: ' + lives;

    if (lives === 0) {
      gameOver();
    } else {
      ballOnPaddle = true;
      ball.reset(paddle.body.x + BALL_WIDTH, PADDLE_Y - BALL_HEIGHT);
      ball.animations.stop();
    }
  }

  function gameOver() {
    ball.body.velocity.setTo(0, 0);

    introText.text = 'Game Over!';
    introText.visible = true;
  }

  function ballHitBrick(_ball, _brick) {
    socket.emit('brick kill from client', {
      row: _brick.row,
      col: _brick.col,
      childrenIndex: _brick.childrenIndex
    });

    _brick.kill();

    score += 10;
    scoreText.text = 'score: ' + score;

    //  Are they any bricks left?
    if (bricks.countLiving() === 0) {
      //  New level starts
      score += 1000;
      scoreText.text = 'score: ' + score;
      introText.text = '- Next Level -';

      //  Let's move the ball back to the paddle
      ballOnPaddle = true;
      ball.body.velocity.set(0);
      ball.body.x = paddle.body.x + BALL_WIDTH;
      ball.body.y = PADDLE_Y - BALL_HEIGHT;
      ball.animations.stop();

      //  And bring the bricks back from the dead :)
      bricks.callAll('revive');
    }
  }

  function ballHitPaddle(_ball, _paddle) {
    var diff = 0;

    if (_ball.body.x < _paddle.body.x) {
      //  Ball is on the left-hand side of the paddle
      diff = _paddle.body.x - _ball.body.x;
      _ball.body.velocity.x = (BALL_X_VELOCITY_MULTIPLIER * diff * -1);
    } else if (_ball.body.x > _paddle.body.x) {
      //  Ball is on the right-hand side of the paddle
      diff = _ball.body.x -_paddle.body.x;
      _ball.body.velocity.x = (BALL_X_VELOCITY_MULTIPLIER * diff);
    } else {
      //  Ball is perfectly in the middle
      //  Add a little random X to stop it bouncing straight up!
      _ball.body.velocity.x = BALL_X_VELOCITY_MULTIPLIER * 0.2 + Math.random() * BALL_X_VELOCITY_MULTIPLIER * 0.8;
    }
  }

  function findPlayerById(id) {
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

}());
