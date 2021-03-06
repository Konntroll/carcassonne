const express = require('express');
const carcassonne = express();
const http = require('http').Server(carcassonne);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs')
const port = process.env.PORT || 80;

let tiles = new Map();
const data = fs.readFileSync('tiles.json', 'utf8');
for (const [tile, sides] of Object.entries(JSON.parse(data))) {
    tiles.set(parseInt(tile), sides);
}

function fill() {
  let bag = [];
  for (let i = 0; i < 71; i++) {
    bag.push(i);
  }
  return bag;
}
function mix(set) {
  for (let i = set.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

carcassonne.get('/', function(req, res) {
   res.sendFile('carcassonne.html', {root: __dirname});
}).use(express.static(path.join(__dirname, '/public')));

let games = new Map();

io.on('connection', function(socket) {
  socket.emit('welcome', listGames());
  socket.on('create', function(game) {
    if (games.get(game)) {
      socket.emit('exists', true);
      return;
    }
    socket.emit('exists', false);
    games.set(game, {
      name: game,
      colors: mix(['white', 'green', 'blue', 'red', 'yellow', 'orange']),
      bag: mix(fill()),
      players: [],
      started: false,
      highlights: new Map()
    });
    socket.game = games.get(game);
    socket.game.players.push(socket);
    socket.color = socket.game.colors.shift();
    socket.game.highlights.set(socket.color, -1);
    socket.score = 0;
    socket.join(game);
    socket.emit('newPlayer', socket.color);
    io.emit('listGame', game);
    io.in(socket.game.name).emit('createScoreTracker', {color: socket.color,
                                                        score: socket.score});
  });
  socket.on('join', function(game) {
    socket.game = games.get(game);
    socket.game.players.push(socket);
    socket.color = socket.game.colors.shift();
    socket.game.highlights.set(socket.color, -1);
    socket.score = 0;
    socket.join(game);
    socket.emit('newPlayer', socket.color);
    let standings = [];
    for (let player of socket.game.players) {
      standings.push({color: player.color, score: player.score});
    }
    socket.to(socket.game.name).emit('createScoreTracker', {color: socket.color,
                                                            score: socket.score});
    socket.emit('fetchScoreTrackers', standings);
  });
  socket.on('leave', function(board) {
    socket.to(socket.game.name).emit('update', board);
    socket.leave(socket.game.name);
    let dropout = socket.game.players.indexOf(socket.id);
    socket.game.players.splice(dropout, 1);
    if (socket.game.players.length > 0) {
      issueTile(socket.game.players[0]);
    }
    socket.color = '';
    socket.score = 0;
    if (socket.game.players.length <= 0) {
      if (!socket.game.started) {
        io.emit('unlistGame', socket.game.name);
      }
      games.delete(socket.game.name);
    }
    socket.game = null;
  });
  socket.on('depopulated', function(board) {
    socket.in(socket.game.name).emit('update', board);
  });
  socket.on('replace', function(tile) {
    let replacement = socket.game.bag.shift();
    socket.game.bag.push(tile);
    mix(socket.game.bag);
    socket.emit('tile', {sides: tiles.get(replacement),
                         key: replacement,
                         rot: 0,
                         claim: {by: null}
                        });
  });
  socket.on('start', function(board) {
    socket.game.started = true;
    io.emit('unlistGame', socket.game.name);
    socket.to(socket.game.name).emit('gameStarted');
    io.in(socket.game.name).emit('update', board);
    issueTile(socket);
  });
  socket.on('restart', function(board) {
    io.in(socket.game.name).emit('restart');
    io.in(socket.game.name).emit('update', board);
    socket.game.bag = mix(fill());
    issueTile(socket);
  });
  socket.on('done', function(board) {
    io.in(socket.game.name).emit('update', board);
    if (socket.game.bag.length > 0) {
      io.in(socket.game.name).emit('message', 'It\'s ' + socket.game.players[0].color + ' player\'s turn.');
      issueTile(socket);
    } else {
      io.in(socket.game.name).emit('gameOver');
    }
  });
  socket.on('highlight', function(key) {
    socket.game.highlights.set(socket.color, key);
  })
  socket.on('scoreUpdate', function(score) {
    socket.score = score;
    io.in(socket.game.name).emit('scoreUpdate', {color: socket.color,
                                                 score: score});
  });
  socket.on('removeScoreTracker', function(color) {
    io.in(socket.game.name).emit('removeScoreTracker', color);
  });
  socket.on('disconnecting', function() {
    if (socket.game) {
      if (socket.game.players.length == 1) {
        games.delete(socket.game.name);
        if (!socket.game.started) {
          socket.emit('unlistGame', socket.game.name);
        }
      }
    }
  });
  socket.on('disconnected', function() {
    if (socket.game) {
      if (socket.game.players.length == 0) {
        games.delete(socket.game.name);
        if (!socket.game.started) {
          socket.emit('unlistGame', socket.game.name);
        }
      }
    }
  });
});

function listGames() {
  let gamesAvailable = []
  for (let [key, game] of games.entries()) {
    if (game.colors.length != 0 &&
        !game.started) {
      gamesAvailable.push(key);
    }
  }
  return gamesAvailable;
};
function issueTile(player) {
  let tile = player.game.bag.shift();
  io.to(player.game.players[0].id).emit('tile',
                      {sides: tiles.get(tile),
                       key: tile,
                       rot: 0,
                       claim: {by: null}
                      }
  );
  io.in(player.game.name).emit('stateUpdate',
                               {color: player.game.players[0].color,
                                tiles: player.game.bag.length,
                                highlights: [...player.game.highlights.entries()]});
  player.game.players.push(player.game.players.shift());
}

http.listen(port, function() {
   console.log('Listening on port ' + port);
});
