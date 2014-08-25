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




# Wireframes

## HTML Pages

- TODO

## Canvas Pages

- TODO




# User Flow

- TODO




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



