;(function () {

  var gameState = { preload: preload, create: create, update: update };
  var game = new Phaser.Game(GAME_WIDTH, GAME_HEIGHT, Phaser.AUTO, 'breakout', gameState);
  var GAME_WIDTH = 800;
  var GAME_HEIGHT = 600;

  var updateLoopRunning = false;

  var sounds;

  var background;

  var bricks;
  var brickBurstEmitter;
  var BRICK_ROWS = 4;
  var BRICK_COLS = 15;
  var BRICK_START_X = 120;
  var BRICK_START_Y = 100;
  var BRICK_SPACING_X = 36;
  var BRICK_SPACING_Y = 52;

  var brickHitDates = [];
  var lastMonsterKillPlayDate = new Date();

  var items;

  var paddle;
  var PADDLE_Y = 500;
  var PADDLE_WIDTH = 48;

  var remotePaddles;

  var ball;
  var ballBlueGlowEmitter;
  var ballGreenGlowEmitter;
  var ballOnPaddle = true;
  var BALL_WIDTH = 16;
  var BALL_HEIGHT = 16;
  var BALL_RELEASE_VELOCITY_X = -75;
  var BALL_RELEASE_VELOCITY_Y = -300;
  var BALL_VELOCITY_MULTIPLIER_X = 8;
  var BALL_VELOCITY_CHANGE = 1.1;

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

  var $leaderboard = $("#leaderboard-table-body");

  var $highScoresMarquee = $("#high-scores");

  var $gameOverDialog= $(".game-over-dialog");
  var $finalScoreSpan;
  var $nameLabel;
  var $nameText;
  var $saveScoreButton;
  var $playAgainButton;

  function preload() {
    console.log('preload invoked');
    game.load.atlas('breakout', '/assets/breakout.png', '/assets/breakout.json');
    game.load.image('blackStarfield', '/assets/black_starfield.png');
    game.load.audio('sfx', 'assets/audio/breakout.mp3');

  }

  function create() {
    console.log('create invoked');

    // Prevent game from pausing when browser tab loses focus
    game.stage.disableVisibilityChange = true;

    game.physics.startSystem(Phaser.Physics.ARCADE);

    background = game.add.tileSprite(0, 0, 800, 600, 'blackStarfield');

    // Check bounds collisions on all walls except bottom
    game.physics.arcade.checkCollision.down = false;

    createRemotePaddles();
    createBricks();
    createBrickBurstEmitter();
    createItems();
    createLocalPaddle();
    createLocalBall();
    createBallBlueGlowEmitter();
    createBallGreenGlowEmitter();
    createText();
    createAudio();
    createGameOverDialog();

    game.input.onDown.add(releaseBall, gameState);

    initializeMixItUp();

    setTimeout(checkFrozenGame, 500);

    socket = io.connect(window.location.hostname);
    attachSocketHandlers();

    $('#breakout').on("mousemove", function mouseMoveHandler() {
      socket.emit("update paddle position", {
        x: game.input.x - 0.5 * PADDLE_WIDTH
      });
    });
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

  function createBrickBurstEmitter() {
    brickBurstEmitter = game.add.emitter(0, 0, 500);
    brickBurstEmitter.makeParticles('breakout', 'brick_chunk.png');
    brickBurstEmitter.gravity = 500;
  }

  function createItems() {
    console.log('createItems invoked');
    items = game.add.group();
    items.enableBody = true;
    items.physicsBodyType = Phaser.Physics.ARCADE;
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

  function createRemotePaddles() {
    console.log('createRemotePaddles invoked');
    remotePaddles = game.add.group();
    remotePaddles.enableBody = true;
    remotePaddles.physicsBodyType = Phaser.Physics.ARCADE;
  }

  function createRemotePaddle(data){
    console.log('createRemotePaddle invoked');
    var player = data.id;
    var remotePaddle;

    if (typeof remotePlayers[player].paddle === 'object') {
      return;
    }

    remotePaddle = remotePaddles.create(
      game.world.centerX,
      PADDLE_Y,
      'breakout',
      'paddle_big.png'
    );
    remotePaddle.anchor.setTo(0.5, 0.5);
    game.physics.enable(remotePaddle, Phaser.Physics.ARCADE);
    remotePaddle.body.collideWorldBounds = true;
    remotePaddle.body.bounce.set(1);
    remotePaddle.body.immovable = true;
    remotePaddle.name = player;
    remotePaddle.tint = data.color;
    remotePaddle.blendMode = PIXI.blendModes.ADD;
    remotePaddle.alpha = 0.7;

    remotePlayers[player].paddle = remotePaddle;
  }

  function createLocalBall() {
    console.log('createLocalBall invoked');
    ball = game.add.sprite(game.world.centerX, PADDLE_Y - BALL_HEIGHT, 'breakout', 'ball.png');
    ball.anchor.set(0.5);
    ball.checkWorldBounds = true;

    game.physics.enable(ball, Phaser.Physics.ARCADE);

    ball.body.collideWorldBounds = true;
    ball.body.bounce.set(1);

    ball.events.onOutOfBounds.add(ballLost, this);
  }

  function createBallBlueGlowEmitter() {
    ballBlueGlowEmitter = game.add.emitter(ball.body.x, ball.body.y, 200);
    ballBlueGlowEmitter.makeParticles('breakout', 'blue_glow.png');
    ballBlueGlowEmitter.gravity = 200;
    ballBlueGlowEmitter.autoAlpha = true;
    ballBlueGlowEmitter.maxParticleAlpha = 0.31;
    ballBlueGlowEmitter.minParticleAlpha = 0.30;
  }

  function createBallGreenGlowEmitter() {
    ballGreenGlowEmitter = game.add.emitter(ball.body.x, ball.body.y, 200);
    ballGreenGlowEmitter.makeParticles('breakout', 'green_glow.png');
    ballGreenGlowEmitter.gravity = -200;
    ballGreenGlowEmitter.autoAlpha = true;
    ballGreenGlowEmitter.maxParticleAlpha = 0.31;
    ballGreenGlowEmitter.minParticleAlpha = 0.30;
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
    console.log('createRemoteBall invoked');

    if (typeof remotePlayers[data.remotePlayerID] !== "undefined") {
      if (remotePlayers[data.remotePlayerID].gameOver === true) {
        console.log("createRemoteBall exiting early because remote player's game is over");
        return;
      }
    }

    var remoteBall = game.add.sprite(data.posX, data.posY, 'breakout', 'ball.png');
    remoteBall.anchor.set(0.5);
    remoteBall.checkWorldBounds = true;
    game.physics.enable(remoteBall, Phaser.Physics.ARCADE);
    remoteBall.body.collideWorldBounds = true;
    remoteBall.body.bounce.set(1);

    remoteBall.body.velocity.x = data.velocityX;
    remoteBall.body.velocity.y = data.velocityY;

    remoteBall.tint = remotePlayers[data.remotePlayerID].color;
    remoteBall.blendMode = PIXI.blendModes.ADD;
    remoteBall.alpha = 0.7;

    remotePlayers[data.remotePlayerID].remotePlayerBall = remoteBall;
  }

  function createText() {
    console.log('createText invoked');
    scoreText = game.add.text(32, TEXT_Y, 'score: ' + score,
      { font: '20px VT323', fill: '#ffffff', align: 'left' });
    livesText = game.add.text(GAME_WIDTH - 120, TEXT_Y, 'lives: ' + lives,
      { font: '20px VT323', fill: '#ffffff', align: 'left' });
    infoText = game.add.text(game.world.centerX, GAME_HEIGHT * (2 / 3), 'Click to Start',
      { font: '40px VT323', fill: '#ffffff', align: 'center' });
    infoText.anchor.setTo(0.5, 0.5);
  }

  function createAudio() {
    sounds = game.add.audio('sfx');

    sounds.addMarker('SM64_Power_Star_Appears', 0, 5);
    sounds.addMarker('powerUp', 5, 3);
    sounds.addMarker('gameOver', 8, 4);
    sounds.addMarker('c', 12, 3);
    sounds.addMarker('cHigh', 15, 3);
    sounds.addMarker('e', 18, 3);
    sounds.addMarker('g', 21, 3);
    sounds.addMarker('gLow', 24, 3);
    sounds.addMarker('monsterKill', 27, 4.5);
    sounds.addMarker('counterTerroristsWin', 32, 2.5);
    sounds.addMarker('Mario_Kart_64_Luigi_Mamma_Mia', 35, 2);
    sounds.addMarker('firstBlood', 37.5, 2);
    sounds.addMarker('terroristsWin', 40, 2);
    sounds.addMarker('outstanding', 42, 2);
    sounds.addMarker('Gears_Of_War_Marcus_Nice_Throw', 44, 2);
    sounds.addMarker('slammin', 46, 2);
    sounds.addMarker('StarCraft_Fenix_Zealot_For_Aiur', 48, 2);
    sounds.addMarker('oneUp', 50, 1);
    sounds.addMarker('Gears_Of_War_Marcus_Ill_Take_This', 52, 2);
    sounds.addMarker('The_Legend_of_Zelda_Get_Item', 54, 1);
    sounds.addMarker('SFIV_Ken_Hadouken', 56, 1);
    sounds.addMarker('SFIV_Ryu_Shoryuken', 58, 1);
    sounds.addMarker('The_Legend_of_Zelda_Get_Rupee', 60, 1);
  }

  function createGameOverDialog() {
    $gameOverDialog.dialog({
      dialogClass: 'no-close',
      draggable: false,
      autoOpen: false,
      show: {
        effect: 'fade',
        duration: 1000
      },
      position: {
        of: '#breakout'
      }
    });

    $finalScoreSpan = $gameOverDialog.find('span.final-score');

    $nameLabel = $gameOverDialog.find('h2.name');

    $nameText = $gameOverDialog.find('input.name');
    $nameText.bind('enterKey', function() {
      submitFinalScore();
    });
    $nameText.keyup(function(event) {
      if (event.keyCode === 13) {
        $nameText.trigger('enterKey');
      }
    });

    $saveScoreButton = $gameOverDialog.find('input.save-score');
    $saveScoreButton.on('click', submitFinalScore);

    $playAgainButton = $gameOverDialog.find('input.play-again');
    $playAgainButton.on('click', reloadPage);
  }

  function submitFinalScore() {
    socket.emit('player final score', {
      name: $nameText.val(),
      score: score
    });
    showSuccessfulScoreSubmission();
  }

  function showSuccessfulScoreSubmission() {
    $nameLabel.text('SCORE SAVED');
    $nameText.remove();
    $saveScoreButton.remove();
  }

  function reloadPage() {
    location.reload();
  }

  function disconnectSocket() {
    socket.io.disconnect();
  }

  function initializeMixItUp() {
    $(function(){
      $leaderboard.mixItUp({
        selectors: {
          target: "tr"
        },
        layout: {
          display: 'table-row'
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
    socket.on('remote player game over', onRemotePlayerGameOver);
    socket.on('play brick hit sound', onPlayBrickHitSound);
    socket.on('first brick hit', onFirstBrickHit);
    socket.on('render plus 500', onRenderPlus500);
    socket.on('render plus 1000', onRenderPlus1000);
    socket.on('play monster kill sound', onPlayMonsterKillSound);
    socket.on('play last brick sound', onPlayLastBrickSound);
    socket.on('high scores', onHighScores);
  }

  function onPlayBrickHitSound(data) {
    if (data.sound === 0) {
      sounds.play('c');
    } else if (data.sound === 1) {
      sounds.play('e');
    } else if (data.sound === 2) {
      sounds.play('g');
    } else {
      sounds.play('cHigh');
    }
  }

  function onFirstBrickHit() {
    console.log('onFirstBrickHit invoked');
    sounds.play('firstBlood');
  }

  function onRenderPlus500(data) {
    console.log('onRenderPlus500 invoked');
    renderBonusIndicator(data.x, data.y, 'breakout', 'plus_500.png');
  }

  function onRenderPlus1000(data) {
    console.log('onRenderPlus1000 invoked');
    renderBonusIndicator(data.x, data.y, 'breakout', 'plus_1000.png');
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
    if (typeof remotePlayers[data.remotePlayerID] !== 'undefined' &&
        typeof remotePlayers[data.remotePlayerID].remotePlayerBall === 'undefined') {
      createRemoteBall(data);
    }
  }

  function onRemoteBallHitPaddle(data) {
    console.log('onPaddleHitBall invoked');
    var remotePlayer = remotePlayers[data.remotePlayerID];
    var remoteBall;
    if (typeof remotePlayer !== "undefined") {
      remoteBall = remotePlayer.remotePlayerBall;
    }
    if (typeof remoteBall !== "undefined") {
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
      gameOver: data.gameOver,
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
    var playerColor = "#" + padHex(message.color.substring(2), 6);
    var $tr;
    var $tdScore;
    var $tdName;
    var $colorCircle;

    if (message.hasOwnProperty('score')) {
      // remote player
      playerScore = message.score;
    } else {
      // local player
      playerScore = score;
      message.name += " (You)";
    }

    $colorCircle = $('<span></span>');
    $colorCircle.css({ background : playerColor, height: '15px', width: '15px', display: 'inline-block', 'margin-right': '5px', 'border-radius' : '50%' });

    $tr = $('<tr></tr>');
    $tr.attr('data-score', playerScore);
    $tr.attr('data-id', message.id);
    $tdScore = $('<td></td>').text(playerScore);
    $tdName = $('<td></td>').text(message.name);

    $tr.append($tdScore).append($tdName).appendTo($leaderboard);

    $tdName.prepend($colorCircle);
  }

  function onRemovePlayer(data) {
    console.log('onRemovePlayer invoked');

    if (typeof remotePlayers[data.id] !== "undefined") {
      var remotePlayerBall = remotePlayers[data.id].remotePlayerBall;

      if (typeof remotePlayerBall !== "undefined") {
        remotePlayerBall.kill();
      }

      var remotePlayerPaddle = remotePlayers[data.id].paddle;
      if (typeof remotePlayerPaddle !== "undefined") {
        remotePlayerPaddle.kill();
      }
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
    if (typeof remotePlayers[data.id] !== 'undefined' ) {
      remotePlayers[data.id].score = data.score;
      updateLeaderboard(data);
    }
  }

  function updateLeaderboard(message) {
    var $tr = $leaderboard.find("[data-id='" + message.id + "']");
    $tr.attr('data-score', message.score);

    var $tdScore = $tr.children().first();
    $tdScore.text(message.score);

    $leaderboard.mixItUp('sort', 'score:desc');
  }

  function update() {
    if (!updateLoopRunning) {
      console.log('update invoked for first time');
      updateLoopRunning = true;
    }

    socket.emit('update ball', {
      x: ball.body.x,
      y: ball.body.y
    });

    paddle.body.x = game.input.x - 0.5 * PADDLE_WIDTH;

    if (paddle.body.x < 0) {
      paddle.body.x = 0;
    } else if (paddle.body.x > game.width - PADDLE_WIDTH) {
      paddle.body.x = game.width - PADDLE_WIDTH;
    }

    if (ballOnPaddle) {
      ball.body.x = paddle.body.x + 0.5 * PADDLE_WIDTH - 0.5 * BALL_WIDTH;
    } else {
      game.physics.arcade.collide(ball, paddle, ballHitPaddle, null, gameState);
      game.physics.arcade.collide(ball, bricks, ballHitBrick, null, gameState);
    }

    if (bricks.countLiving() === 0) {
      startNewRound();
    }

    if (!$.isEmptyObject(remotePlayers)) {
      updatePaddlePositions();
    }

    game.physics.arcade.collide(brickBurstEmitter);
    game.physics.arcade.collide(paddle, items, paddleCaughtItem, null, gameState);

    ballBlueGlowEmitter.x = ball.body.x;
    ballBlueGlowEmitter.y = ball.body.y;

    ballGreenGlowEmitter.x = ball.body.x;
    ballGreenGlowEmitter.y = ball.body.y;
  }

  function paddleCaughtItem(_paddle, _item) {
    _item.kill();

    if ($gameOverDialog.dialog('isOpen')) {
      return;
    }

    if (_item.type === 'extraLife') {
      addExtraLife();
      sounds.play('oneUp');

   } else if (_item.type === 'increaseSpeed') {
      increaseBallSpeed();
      setTimeout(decreaseBallSpeed, 5000);

      ballGreenGlowEmitter.start(false, 100, 15);
      setTimeout(turnOffGreenGlow, 5000);

      sounds.play('powerUp');
    } else if (_item.type === 'decreaseSpeed') {
      decreaseBallSpeed();
      setTimeout(increaseBallSpeed, 5000);

      ballBlueGlowEmitter.start(false, 120, 30);
      setTimeout(turnOffBlueGlow, 5000);

      sounds.play('powerUp');
    } else if (_item.type === 'gowMarcusIllTakeThis') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('Gears_Of_War_Marcus_Ill_Take_This');
    } else if (_item.type === 'gowMarcusNiceThrow') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('Gears_Of_War_Marcus_Nice_Throw');
    } else if (_item.type === 'mk64Luigi') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('Mario_Kart_64_Luigi_Mamma_Mia');
    } else if (_item.type === 'kenHadouken') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('SFIV_Ken_Hadouken');
    } else if (_item.type === 'ryuShoruken') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('SFIV_Ryu_Shoryuken');
    } else if (_item.type === 'sm64PowerStar') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('SM64_Power_Star_Appears');
    } else if (_item.type === 'starcraftZeolot') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('StarCraft_Fenix_Zealot_For_Aiur');
    } else if (_item.type === 'zeldaItem') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('The_Legend_of_Zelda_Get_Item');
    } else if (_item.type === 'zeldaRupee') {
      plus500Points();
      renderBonusIndicator(_paddle.x, PADDLE_Y, 'breakout', 'plus_500.png');
      sounds.play('The_Legend_of_Zelda_Get_Rupee');
    }
  }

  function addExtraLife() {
    console.log('addExtraLife invoked');
    if ($gameOverDialog.dialog('isOpen')) {
      return;
    }
    lives++;
    livesText.text = 'lives: ' + lives;
    renderBonusIndicator(paddle.body.x, PADDLE_Y, 'breakout', 'one_up.png');
  }

  function renderBonusIndicator(x, y, key, frame) {
    var indicator = game.add.sprite(x, y, key, frame);
    indicator.enableBody = true;
    game.physics.enable(indicator, Phaser.Physics.ARCADE);
    indicator.body.velocity.y = -100;
    indicator.lifespan = 2000;
    game.add.tween(indicator).delay(500).to({alpha: 0}, 1500).start();
  }

  function plus500Points() {
    socket.emit('plus 500 points');
  }

  function increaseBallSpeed() {
    console.log('increaseBallSpeed invoked');
    ball.body.velocity.x *= BALL_VELOCITY_CHANGE;
    ball.body.velocity.y *= BALL_VELOCITY_CHANGE;
    BALL_RELEASE_VELOCITY_X *= BALL_VELOCITY_CHANGE;
    BALL_RELEASE_VELOCITY_Y *= BALL_VELOCITY_CHANGE;
    BALL_VELOCITY_MULTIPLIER_X *= BALL_VELOCITY_CHANGE;
  }

  function decreaseBallSpeed() {
    console.log('decreaseBallSpeed invoked');
    ball.body.velocity.x /= BALL_VELOCITY_CHANGE;
    ball.body.velocity.y /= BALL_VELOCITY_CHANGE;
    BALL_RELEASE_VELOCITY_X /= BALL_VELOCITY_CHANGE;
    BALL_RELEASE_VELOCITY_Y /= BALL_VELOCITY_CHANGE;
    BALL_VELOCITY_MULTIPLIER_X /= BALL_VELOCITY_CHANGE;
  }

  function turnOffBlueGlow() {
    ballBlueGlowEmitter.on = false;
  }

  function turnOffGreenGlow() {
    ballGreenGlowEmitter.on = false;
  }

  function releaseBall() {
    if (ballOnPaddle) {
      ballOnPaddle = false;
      ball.body.velocity.x = BALL_RELEASE_VELOCITY_X * ( Math.random() * 4 - 1 );
      ball.body.velocity.y = BALL_RELEASE_VELOCITY_Y;
      infoText.visible = false;

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
    sounds.play('gameOver');

    ball.body.velocity.setTo(0, 0);
    socket.emit('player game over');
    showGameOverDialog();
  }

  function showGameOverDialog() {
    $gameOverDialog.dialog('open');
    $nameText.val(localPlayerName);
    $nameText.select();
    $finalScoreSpan.text(score);
  }

  function ballHitBrick(_ball, _brick) {
    playBrickHitSound(_brick.y);

    socket.emit('brick kill from client', {
      brickIndex: _brick.brickIndex,
      brickX: _brick.x,
      brickY: _brick.y,
      velocityX: ball.body.velocity.x,
      velocityY: ball.body.velocity.y
    });

    var randNum = Math.random();

    if (randNum > 0 && randNum < 0.02) {
      // 2% chance
      createItem('extraLife', 'extra_life.png', _brick.x, _brick.y);
    } else if (randNum > 0.10 && randNum < 0.15) {
      // 5% chance
      createItem('increaseSpeed', 'increase_speed.png', _brick.x, _brick.y);
    } else if (randNum > 0.15 && randNum < 0.20) {
      // 5% chance
      createItem('decreaseSpeed', 'decrease_speed.png', _brick.x, _brick.y);
    } else if (randNum > 0.20 && randNum < 0.21) {
      // 1% chance
      createItem('gowMarcusIllTakeThis', 'Gears_Of_War_Marcus_Ill_Take_This.png', _brick.x, _brick.y);
    } else if (randNum > 0.21 && randNum < 0.22) {
      // 1% chance
      createItem('gowMarcusNiceThrow', 'Gears_Of_War_Marcus_Nice_Throw.png', _brick.x, _brick.y);
    } else if (randNum > 0.22 && randNum < 0.23) {
      // 1% chance
      createItem('mk64Luigi', 'Mario_Kart_64_Luigi_Mamma_Mia.png', _brick.x, _brick.y);
    } else if (randNum > 0.23 && randNum < 0.24) {
      // 1% chance
      createItem('kenHadouken', 'SFIV_Ken_Hadouken.png', _brick.x, _brick.y);
    } else if (randNum > 0.24 && randNum < 0.25) {
      // 1% chance
      createItem('ryuShoruken', 'SFIV_Ryu_Shoryuken.png', _brick.x, _brick.y);
    } else if (randNum > 0.25 && randNum < 0.26) {
      // 1% chance
      createItem('sm64PowerStar', 'SM64_Power_Star_Appears.png', _brick.x, _brick.y);
    } else if (randNum > 0.26 && randNum < 0.27) {
      // 1% chance
      createItem('starcraftZeolot', 'StarCraft_Fenix_Zealot_For_Aiur.png', _brick.x, _brick.y);
    } else if (randNum > 0.27 && randNum < 0.28) {
      // 1% chance
      createItem('zeldaItem', 'The_Legend_of_Zelda_Get_Item.png', _brick.x, _brick.y);
    } else if (randNum > 0.28 && randNum < 0.29) {
      // 1% chance
      createItem('zeldaRupee', 'The_Legend_of_Zelda_Get_Rupee.png', _brick.x, _brick.y);
    }

    renderBrickBurst(_brick);
    _brick.kill();

    brickHitDates.push(new Date());
    checkForMonsterKill();
  }

  function playBrickHitSound(y) {
    if (y === 100) {
      sounds.play('cHigh');
      socket.emit('play brick hit sound', {sound: 3});
    } else if (y === 152) {
      sounds.play('g');
      socket.emit('play brick hit sound', {sound: 2});
    } else if (y === 204) {
      sounds.play('e');
      socket.emit('play brick hit sound', {sound: 1});
    } else {
      sounds.play('c');
      socket.emit('play brick hit sound', {sound: 0});
    }
  }

  function renderBrickBurst(_brick) {
    brickBurstEmitter.x = _brick.x;
    brickBurstEmitter.y = _brick.y;
    brickBurstEmitter.start(true, 2000, null, Math.floor(Math.random() * 10) + 5);
  }

  function createItem(itemType, itemImage, x, y) {
    var item = items.create(x, y, 'breakout', itemImage);
    item.type = itemType;
    item.anchor.setTo(0.5, 0.5);
    item.checkWorldBounds = true;
    item.outOfBoundsKill = true;
    game.physics.enable(item, Phaser.Physics.ARCADE);
    item.body.velocity.y = 100;
  }

  function checkForMonsterKill() {
    var length = brickHitDates.length;
    if (length < 6) {
      return;
    }
    var lastFiveHitsTimeDifference = brickHitDates[length - 1] - brickHitDates[length - 6];
    if (lastFiveHitsTimeDifference < 550 && (new Date() - lastMonsterKillPlayDate > 10000)) {
      console.log('monsterKill awarded to this client');
      sounds.play('monsterKill');
      lastMonsterKillPlayDate = new Date();
      renderBonusIndicator(ball.body.x, ball.body.y, 'breakout', 'plus_1000.png');
      socket.emit('monster kill');
    }
  }

  function onPlayMonsterKillSound() {
    console.log('onPlayMonsterKillSound invoked');
    sounds.play('monsterKill');
  }

  function onPlayLastBrickSound(data) {
    var randomSoundIndex = Math.floor(data.randSoundNum * 4);
    if (randomSoundIndex === 0) {
      sounds.play('counterTerroristsWin');
    } else if (randomSoundIndex === 1) {
      sounds.play('terroristsWin');
    } else if (randomSoundIndex === 2) {
      sounds.play('slammin');
    } else if (randomSoundIndex === 3) {
      sounds.play('outstanding');
    }
  }

  function ballHitPaddle(_ball, _paddle) {
    sounds.play('gLow');

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

  function onUpdatePaddlePosition(data) {
    if (typeof remotePlayers[data.id] !== 'undefined') {
      remotePlayers[data.id].paddleX = data.x;
    }
  }

  function updatePaddlePositions() {
    $.each(remotePlayers, function(remotePlayerID, remotePlayer) {
      if (typeof remotePlayer.paddle !== 'undefined') {
        remotePlayer.paddle.body.x = remotePlayer.paddleX;
      }
    });
  }

  function onRemotePlayerGameOver(data) {
    if (typeof remotePlayers[data.id] !== 'undefined') {
      remotePlayers[data.id].gameOver = true;
    }
  }

  function onHighScores(data) {
    console.log('onHighScores invoked. data = ' + JSON.stringify(data));

    $highScoresMarquee.empty();
    $highScoresMarquee.append('HIGH SCORES: ');

    $.each(data.scores, function(index, val) {
      var score = val.score.toString();
      var rank = (index + 1).toString();
      var playerScoreSpan = $('<span></span>').addClass('top-score').text(rank + '. ' + val.name + ' (' + score + ') ');
      $highScoresMarquee.append(playerScoreSpan);
    });
  }

  function checkFrozenGame() {
    if (!updateLoopRunning) {
      reloadPage();
    }
  }

  function padHex(n, width) {
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
  }

}());
