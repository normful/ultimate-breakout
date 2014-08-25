var Player = function(startPaddleX, startBallX, startBallY) {
  'use strict';

  var id;
  var paddleX = startPaddleX;
  var ballX = startBallX;
  var ballY = startBallY;

  // Getters and setters
  var getPaddleX = function() {
    return paddleX;
  };

  var setPaddleX = function(newPaddleX) {
    paddleX = newPaddleX;
  };

  var getBallX = function() {
    return ballX;
  };

  var setBallX = function(newBallX) {
    ballX = newBallX;
  };

  var getBallY = function() {
    return ballY;
  };

  var setBallY = function(newBallY) {
    ballY = newBallY;
  };

  // Define which variables and methods can be accessed
  return {
    getPaddleX: getPaddleX,
    setPaddleX: setPaddleX,
    getBallX: getBallX,
    setBallX: setBallX,
    getBallY: getBallY,
    setBallY: setBallY,
    id: id
  };
};
