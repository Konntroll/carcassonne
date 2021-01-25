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
    games.set(game, {
      name: game,
      colors: mix(['white', 'green', 'blue', 'red', 'yellow', 'orange']),
      bag: mix(fill()),
      players: [],
      started: false
    });
    socket.game = games.get(game);
    socket.game.players.push(socket);
    socket.color = socket.game.colors.shift();
    socket.join(game);
    socket.emit('newPlayer', socket.color);
    io.emit('listGame', game);
  });
  socket.on('join', function(game) {
    socket.game = games.get(game);
    socket.game.players.push(socket);
    socket.color = socket.game.colors.shift();
    socket.join(game);
    socket.emit('newPlayer', socket.color);
  });
  socket.on('leave', function() {
    socket.leave(socket.game.name);
    let dropout = socket.game.players.indexOf(socket.id);
    socket.game.players.splice(dropout, 1);
    io.to(socket.game.name).emit('depopulate', socket.color);
    socket.color = '';
    if (socket.game.players.length <= 0) {
      if (!socket.game.started) {
        io.emit('unlistGame', socket.game.name);
      }
      games.delete(socket.game.name);
    }
    socket.game = null;
  });
  socket.on('start', function(board) {
    socket.game.started = true;
    io.emit('unlistGame', socket.game.name);
    socket.to(socket.game.name).emit('gameStarted');
    let tile = socket.game.bag.shift();
    io.in(socket.game.name).emit('update', board);
    io.to(socket.game.players[0].id).emit('tile',
                        {sides: tiles.get(tile),
                         key: tile,
                         rot: 0,
                         claim: {by: null}
                        }
    );
    socket.game.players.push(socket.game.players.shift());
  });
  socket.on('done', function(board) {
    let tile = socket.game.bag.shift();
    io.in(socket.game.name).emit('update', board);
    io.to(socket.game.players[0].id).emit('tile',
                        {sides: tiles.get(tile),
                         key: tile,
                         rot: 0,
                         claim: {by: null}
                        }
    );
    socket.game.players.push(socket.game.players.shift());
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

http.listen(port, function() {
   console.log('Listening on port ' + port);
});
