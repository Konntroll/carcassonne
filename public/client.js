var socket = io();

let hand = null;
let color = '';
let currentPlayer = '';
let meeples = 7;
let score = 0;
let seed = {sides: ["C", "R", "F", "R"],
            key: 'seed',
            rot: 0,
            claim: {by: 'seed'}};
let board = [
  [0, 0 ,0],
  [0, seed, 0],
  [0, 0 ,0]
];

socket.on('newPlayer', function(newColor) {
  color = newColor;
  document.getElementById('tokenColor').style.fill = color;
});
socket.on('stateUpdate', function(state) {
  currentPlayer = state.color;
  document.getElementById('tilesLeft').innerHTML = state.tiles;
});
socket.on('tile', function(data) {
  hand = data;
  let display = document.getElementById('hand');
  display.src = 'tiles/' + hand.key + '.jpg';
});
socket.on('update', function(update) {
  board = update;
  document.documentElement.style.setProperty("--cols", board[0].length);
  set();
});
socket.on('listGame', function(game) {
  makeGameEntry(game);
  toggleGameList();
});
socket.on('unlistGame', function (game) {
  let entry = document.getElementById(game);
  entry.parentNode.removeChild(entry);
  toggleGameList();
});
socket.on('welcome', function(games) {
  for (let game of games) {
    if (document.getElementById(game)) continue;
    makeGameEntry(game);
  }
  toggleGameList();
});
socket.on('gameStarted', function() {
  document.getElementById('start').style.display = 'none';
  document.getElementById('done').style.display = 'flex';
})
socket.on('scoreUpdate', function(data) {
  document.getElementById(data.color).innerHTML = data.score;
});
socket.on('createScoreTracker', function(color) {
  createScoreTracker(color);
});
socket.on('fetchScoreTrackers', function(colors) {
  for (let color of colors) {
    createScoreTracker(color);
  }
});
socket.on('removeScoreTracker', function(color) {
  removeScoreTracker(color);
});
function createScoreTracker(color) {
  let entry = document.createElement('div');
  entry.className = 'scores';
  entry.id = color + 'Player';
  let token = document.createElement('img');
  token.src = color + '.svg';
  token.className = "playerToken";
  let score = document.createElement('div');
  score.id = color;
  entry.appendChild(token);
  entry.appendChild(score);
  document.getElementById('scoreTrackers').appendChild(entry);
  document.getElementById(color).innerHTML = 0;
}
function removeScoreTracker(color) {
  let scoreTracker = document.getElementById(color + 'Player');
  scoreTracker.parentNode.removeChild(scoreTracker);
}
function changeScore() {
  event.preventDefault();
  score += event.deltaY * -0.01;
  if (score < 0) score = 0;
  document.getElementById('score').innerHTML = score;
  socket.emit('scoreUpdate', score);
}
function toggleGameList() {
  let games = document.getElementById('games');
  if (games.children.length > 1) {
    document.getElementById('games').style.display = "block";
  } else {
    document.getElementById('games').style.display = "none";
  }
}
function makeGameEntry(name) {
  let entry = document.createElement("div");
  entry.id = name;
  entry.className = 'gamesAvailable';
  let title = document.createTextNode(name);
  entry.onclick = function() {
    socket.emit('join', name);
    document.getElementById('create').style.display = "none";
    document.getElementById('display').style.display = 'block';
    document.getElementById('infoAndControls').style.display = 'flex';
  }
  entry.appendChild(title);
  document.getElementById('games').appendChild(entry);
}
function createGame() {
  if (event.keyCode === 13 || event.button === 0) {
    socket.emit('create', document.getElementById('startGame').value);
    document.getElementById('startGame').value = '';
    document.getElementById('create').style.display = "none";
    document.getElementById('display').style.display = 'block';
    document.getElementById('infoAndControls').style.display = 'flex';
  }
}
function leave() {
  depopulate();
  hand = null;
  let display = document.getElementById('hand');
  display.src = 'tiles/back.jpg';
  display.style.transform = 'rotate(0deg)';
  meeples = 7;
  score = 0;
  document.getElementById('tilesLeft').innerHTML = 71;
  socket.emit('removeScoreTracker', color);
  color = '';
  document.getElementById('score').innerHTML = score;
  document.getElementById('meeplesLeft').innerHTML = meeples;
  socket.emit('leave', board);
  document.getElementById('board').innerHTML = '';
  board = [
    [0, 0 ,0],
    [0, seed, 0],
    [0, 0 ,0]
  ];
  document.getElementById('create').style.display = "block";
  document.getElementById('display').style.display = 'none';
  document.getElementById('infoAndControls').style.display = 'none';
  document.getElementById('start').style.display = 'flex';
  document.getElementById('done').style.display = 'none';
}
function rotate() {
  let tile = document.getElementById('hand');
  if (tile.src.charAt(tile.src.length - 5) == 'k') return;
  hand.sides.unshift(hand.sides.pop());
  hand.rot == 3 ? hand.rot = 0 : hand.rot++;
  tile.style.transform = 'rotate(' + 90 * hand.rot + 'deg)';
}
function redraw() {
  if (!hand) return;
  for (const side of hand.sides) {
    for (const [y, row] of board.entries()) {
      for (const [x, column] of row.entries()) {
        if (column == 0) {
          if (validate(y, x)) return;
        }
      }
    }
    rotate();
  }
  return;
  socket.emit('replace', hand.key);
  hand = null;
}
function set() {
  let play = document.getElementById('board');
  play.innerHTML = '';
  let tile;
  let pic;
  for (const [y, row] of board.entries()) {
    for (const [x, column] of row.entries()) {
      tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = y + '.' + x;
      if (column == 0) {
        tile.addEventListener('click', function() {
            if(validate(y, x)) place(y, x);
        });
      } else {
        pic = document.createElement('img');
        pic.src = 'tiles/' + board[y][x].key + '.jpg';
        pic.className = 'pic';
        pic.id = board[y][x].key;
        pic.style.transform = 'rotate(' + 90 * board[y][x].rot + 'deg)';
        pic.addEventListener('click', function() {
          if (board[y][x].claim.by || meeples == 0) return;
          board[y][x].claim.by = color;
          let offsetTop = document.documentElement.scrollTop - 75 - (y * 4);
          let offsetLeft = document.documentElement.scrollLeft - 15 - (x * 4);
          board[y][x].claim.top = (event.clientY + offsetTop) % 193 - 24 + 'px';
          board[y][x].claim.left = (event.clientX + offsetLeft) % 193 - 24 + 'px';
          meeples--;
          document.getElementById('meeplesLeft').innerHTML = meeples;
          claim(y, x);
        });
        tile.appendChild(pic);
      }
      play.appendChild(tile);
    }
  }
  populate();
}
function populate() {
  for (const [y, row] of board.entries()) {
    for (const [x, column] of row.entries()) {
      if (column == 0 || column.claim.by == 'seed') {
        continue;
      } else {
        if (column.claim.by) {
          claim(y, x);
        }
      }
    }
  }
}
function depopulate() {
  //this removes all the meeples placed by a player who
  //has just left the game with next update of the board
  for (const [y, row] of board.entries()) {
    for (const [x, column] of row.entries()) {
      if (column == 0 || column.claim.by == 'seed') {
        continue;
      } else {
        if (column.claim.by == color) {
          column.claim.by = null;
        }
      }
    }
  }
  socket.emit('depopulated', board);
}
function claim(y, x) {
  let meeple = document.createElement('img');
  meeple.src = board[y][x].claim.by + '.svg';
  meeple.className = 'meeple';
  meeple.id = x + 'meeple' + y
  meeple.style.top = board[y][x].claim.top;
  meeple.style.left = board[y][x].claim.left;
  meeple.addEventListener('click', function() {
    reclaim(y, x);
  });
  document.getElementById(y + '.' + x).appendChild(meeple);
};
function reclaim(y, x) {
  if (board[y][x].claim.by != color) return;
  document.getElementById(x + 'meeple' + y).remove();
  meeples++;
  document.getElementById('meeplesLeft').innerHTML = meeples;
  board[y][x].claim.by = null;
};
function validate(y, x) {
  let touching = 0;
  if (y - 1 >= 0) {
    if (board[y-1][x]) {
      if (board[y-1][x].sides[2] != hand.sides[0]) {
        return false;
      } else {
        touching++;
      }
    }
  }
  if (y + 1 <= board.length - 1) {
    if (board[y+1][x]) {
      if (board[y+1][x].sides[0] != hand.sides[2]) {
        return false;
      } else {
        touching++;
      }
    }
  }
  if (x - 1 >= 0) {
    if (board[y][x-1]) {
      if (board[y][x-1].sides[1] != hand.sides[3]) {
        return false;
      } else {
        touching++;
      }
    }
  }
  if (x + 1 <= board[0].length - 1) {
    if (board[y][x+1]) {
      if (board[y][x+1].sides[3] != hand.sides[1]) {
        return false;
      } else {
        touching++;
      }
    }
  }
  if (touching > 0) {
    return true;
  } else {
    return false;
  }
}
function place(y, x) {
  if (!hand) return;
  board[y][x] = hand;
  let tile = document.createElement('img');
  tile.src = 'tiles/' + board[y][x].key + '.jpg';
  tile.id = board[y][x].key;
  document.getElementById(y + '.' + x).appendChild(tile);
  expand(y, x);
  hand = null;
  let display = document.getElementById('hand');
  display.src = 'tiles/back.jpg';
  display.style.transform = 'rotate(0deg)';
}
function expand(y, x) {
  if (y == 0) {
    let row = [];
    let base = board[0].length;
    while (row.length != base) {
        row.push(0);
    }
    board.unshift(row);
  }
  if (y == board.length - 1) {
    let row = [];
    let base = board[0].length;
    while (row.length != base) {
        row.push(0);
    }
    board.push(row);
  }
  if (x == 0) {
    for (let row of board) {
        row.unshift(0);
    }
    document.documentElement.style.setProperty("--cols", board[0].length);
  }
  if (x == board[0].length - 1) {
    for (let row of board) {
        row.push(0);
    }
    document.documentElement.style.setProperty("--cols", board[0].length);
  }
  set();
}
function start() {
  socket.emit('start', board);
  document.getElementById('start').style.display = 'none';
  document.getElementById('done').style.display = 'flex';
}
function done() {
  if (!hand && currentPlayer == color) {
    socket.emit('done', board);
  }
}