var Player = function(startPaddleX, startBallX, startBallY) {
  'use strict';

  var id;
  var paddleX = startPaddleX;
  var ballX = startBallX;
  var ballY = startBallY;
  var score;

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

  var getScore = function() {
    return score;
  }

  var setScore = function(newScore) {
    score = newScore;
  }


  // Define which variables and methods can be accessed
  return {
    getPaddleX: getPaddleX,
    setPaddleX: setPaddleX,
    getBallX: getBallX,
    setBallX: setBallX,
    getBallY: getBallY,
    setBallY: setBallY,
    getScore: getScore,
    setScore: setScore,
    id: id
  };
};
