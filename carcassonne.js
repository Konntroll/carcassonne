var express = require('express');
var carcass = express();
var http = require('http').Server(carcass);
var io = require('socket.io')(http);
var path = require('path');
const fs = require('fs')
var port = process.env.PORT || 80;

let pool;
try {
  const data = fs.readFileSync('tiles.json', 'utf8');
  pool = JSON.parse(data);
} catch (err) {
  console.error(err);
}
//console.log(typeof(pool));
let tiles = new Map();
for (const [tile, sides] of Object.entries(pool)) {
    tiles.set(parseInt(tile), sides);
}
console.log(tiles);
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
  socket.emit('hi', 'test');
});

http.listen(port, function() {
   console.log('Listening on port ' + port);
});
