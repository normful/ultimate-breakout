var Bricks = function(){
  'use strict';

  var bricks = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  var getBricks = function(){
    return bricks;
  };

  var killBrick = function(row, column){
    bricks[row][column] = 0;
  };

  return {
    getBricks: getBricks,
    killBrick: killBrick
  };
}

// Export the Bricks class so you can use it in
// other files by using require("Player").Player
exports.Bricks = Bricks;