var Bricks = function(initialBricks) {
  'use strict';

  var bricks = initialBricks;

  var getBricks = function(){
    return bricks;
  };

  var killBrick = function(x, y) {
    // TODO
  };

  return {
    getBricks: getBricks,
    killBrick: killBrick
  };
}