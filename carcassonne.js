const express = require('express');
const carcass = express();
const http = require('http').Server(carcass);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs')
const port = process.env.PORT || 3000;

let tiles = new Map();
const data = fs.readFileSync('tiles.json', 'utf8');
for (const [tile, sides] of Object.entries(JSON.parse(data))) {
    tiles.set(parseInt(tile), sides);
}

let keys = mix();

function mix() {
  let bag = [];
  for (let i = 0; i < 71; i++) {
    bag.push(i);
  }
  for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

carcass.get('/', function(req, res) {
   res.sendFile('carcassonne.html', {root: __dirname});
}).use(express.static(path.join(__dirname, '/public')));

io.on('connection', function(socket) {
  let key = keys.shift();
  socket.emit('tile', {sides: tiles.get(key),
                       key: key,
                       rot: 0,
                       claim: {},
                       new: false
                      });
  socket.on('placed', function() {
    let key = keys.shift();
    socket.emit('tile', {sides: tiles.get(key),
                         key: key,
                         rot: 0,
                         claim: {},
                         new: false
                        });
  });
});

http.listen(port, function() {
   console.log('Listening on port ' + port);
});
