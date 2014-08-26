# Project Name

- TODO

# Project Description

- TODO



# Frameworks and Tools

## Front-end

- Phaser (JS 2D game engine library) <https://github.com/photonstorm/phaser>

## Back-end

- Node.js
- Express

## Servers and Deployment

- Deploy Node.js server to Heroku that both:
    1. Listens for WebSocket connections to synchronize clients.
    2. Serves (using Express) the compiled assets in the `/dist` folder..



# Data

## Socket Message Protocol

- What game data needs to be transmitted?
- What format will the messages be in? (We should write rough, but detailed specification for the data message format so that we know exactly what's being transmitted.)
- What calculations or checks need to be done with these messages?

## Database (if applicable)

- ERD diagram (if applicable)
- Models (if applicable)





# Features and User Stories

## Core User Stories

- TODO

## Optional User Stories

In descending order of implementation priority:

- TODO

Unsorted list of features from brainstorming:

- multiple users
- subsequent users can join an already started game

- multiple paddles
- different paddle colours
- varying paddle length, depending on user count
- varying paddle length, depending on level
- transparent paddles

- chorded sounds

- different ball speeds
- circular game field with a single circular inner target
    - shrinking inner target
    - growing inner target
    - exploding inner target

- combo brick hits do something special



# Wireframes

## HTML Pages

- TODO

## Canvas Pages

- TODO



# Gameplay Options

## Competitive individual players

- Game objective: Get the most points from their 3 lives.
- Win condition: Be the player with the highest score on the leaderboard.
- Loss condition: When the player runs out of lives.

### Joining a game

- A player can join at any time.

### Interaction with other users

- A player hits the same bricks as the other players.
- A player has their own ball and paddle and cannot interact with other players' balls or paddles.
- If a player hits a brick in their game, it disappears from the bricks in the other players' games.
- Remote players' balls and paddles are visible on the screen and rendered semi-transparent.
- Remote players' balls and paddles are rendered underneath the local player's ball and paddle.

### Lives

- Each player is given 3 lives.

### Leaderboard

- The leaderboard is reset every week.

### Rounds

- A round ends when all bricks are cleared from the board.

### Game end

- The game never ends.
- When no users are connected, the canvas is reset.

## Competitive 2 teams with inverted bricks

- Team 1 starts with a random arrangement of 50% of the bricks on the canvas being shown.
- Team 2 starts with the inverse of Team 1's brick arrangement.
- When a player on Team 1 kills a brick, it disappears from Team 1's canvas and appears on Team 2's canvas.
- Conversely, when a player on Team 2 kills a brick, it disappears from Team 2's canvas and appears on Team 1's canvas.
- Each player is given unlimited lives.

- Game objective: Beat the other team at clearing bricks.
- Win condition: When our team has cleared all bricks from our canvas.
- Loss condition: When the opposing team has cleared all bricks from our canvas.

## Collaborative team game

- When the first player connects to the server, they are given the option of selecting a team name.
- All subsequent players connecting to the server become team members on the currently existing team and contribute to the current game.
- Each player starts with 3 lives.

- Game objective: As a team (of 1 or more players), get to the furthest level.
- Win condition: Be the team with the furthest level on the leaderboard.
- Loss condition: When all players on the team have lost their 3 lives.



















# Task Breakdown

- Trello: <https://trello.com/b/0PkbGFl9/breakout>



# Tips from Don

- Build out 2-player architecture from the start.
- Do as much client-side processing as possible.
- Make transmitted data as lightweight as possible. (for example, only sending ball hit and angle events)
- Clients should send the ball hit data as the ball is travelling between subsequent hits.
- UI should be either fully retro or fully modern



# Tips from Khurram

1. Find a way to divide up the work.



# Tips from Murat

- TBD



