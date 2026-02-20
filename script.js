const TILE = 32;
const COLS = 21;
const ROWS = 14;
const WALL = 0;
const FLOOR = 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  floor: document.getElementById('floor'),
  hp: document.getElementById('hp'),
  atk: document.getElementById('atk'),
  enemies: document.getElementById('enemies'),
  message: document.getElementById('message'),
  restart: document.getElementById('restart'),
};

let state;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function carveRoom(map, x, y, w, h) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      map[j][i] = FLOOR;
    }
  }
}

function carveCorridor(map, x1, y1, x2, y2) {
  let x = x1;
  let y = y1;
  while (x !== x2) {
    map[y][x] = FLOOR;
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    map[y][x] = FLOOR;
    y += y < y2 ? 1 : -1;
  }
  map[y][x] = FLOOR;
}

function createLevel(floor) {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));
  const rooms = [];
  const roomAttempts = 32;

  for (let i = 0; i < roomAttempts; i++) {
    const w = rand(4, 7);
    const h = rand(4, 6);
    const x = rand(1, COLS - w - 2);
    const y = rand(1, ROWS - h - 2);
    const room = { x, y, w, h };

    const overlap = rooms.some((r) =>
      x <= r.x + r.w + 1 &&
      x + w + 1 >= r.x &&
      y <= r.y + r.h + 1 &&
      y + h + 1 >= r.y
    );

    if (!overlap) {
      carveRoom(map, x, y, w, h);
      const center = { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) };
      if (rooms.length > 0) {
        const prev = rooms[rooms.length - 1].center;
        carveCorridor(map, prev.x, prev.y, center.x, center.y);
      }
      rooms.push({ ...room, center });
    }
  }

  const start = rooms[0]?.center ?? { x: 1, y: 1 };
  const stairs = rooms[rooms.length - 1]?.center ?? { x: COLS - 2, y: ROWS - 2 };

  const enemies = [];
  const enemyCount = Math.min(3 + floor * 2, 15);
  for (let i = 0; i < enemyCount; i++) {
    const pos = randomFloorPosition(map, [start, stairs, ...enemies]);
    enemies.push({ ...pos, hp: 4 + floor, atk: 1 + Math.floor(floor / 2) });
  }

  const potionCount = Math.min(2 + Math.floor(floor / 2), 8);
  const potions = [];
  for (let i = 0; i < potionCount; i++) {
    const pos = randomFloorPosition(map, [start, stairs, ...enemies, ...potions]);
    potions.push(pos);
  }

  return { map, start, stairs, enemies, potions };
}

function randomFloorPosition(map, blocked = []) {
  while (true) {
    const x = rand(1, COLS - 2);
    const y = rand(1, ROWS - 2);
    const occupied = blocked.some((b) => b.x === x && b.y === y);
    if (map[y][x] === FLOOR && !occupied) return { x, y };
  }
}

function initGame() {
  state = {
    floor: 1,
    player: { x: 0, y: 0, hp: 16, maxHp: 16, atk: 3 },
    level: null,
    gameOver: false,
  };
  loadFloor();
  setMessage('你踏入了迷宫。');
  render();
}

function loadFloor() {
  state.level = createLevel(state.floor);
  state.player.x = state.level.start.x;
  state.player.y = state.level.start.y;
}

function setMessage(msg) {
  ui.message.textContent = msg;
}

function getEnemyAt(x, y) {
  return state.level.enemies.find((e) => e.x === x && e.y === y);
}

function movePlayer(dx, dy) {
  if (state.gameOver) return;

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
  if (state.level.map[ny][nx] === WALL) {
    setMessage('墙挡住了去路。');
    return;
  }

  const enemy = getEnemyAt(nx, ny);
  if (enemy) {
    enemy.hp -= state.player.atk;
    setMessage(`你攻击敌人，造成 ${state.player.atk} 点伤害。`);
    if (enemy.hp <= 0) {
      state.level.enemies = state.level.enemies.filter((e) => e !== enemy);
      setMessage('你击败了敌人！');
      if (Math.random() < 0.25) {
        state.player.atk += 1;
        setMessage('敌人掉落战利品，你的攻击 +1。');
      }
    }
  } else {
    state.player.x = nx;
    state.player.y = ny;
  }

  const potionIndex = state.level.potions.findIndex((p) => p.x === state.player.x && p.y === state.player.y);
  if (potionIndex >= 0) {
    state.level.potions.splice(potionIndex, 1);
    const heal = rand(3, 6);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    setMessage(`你喝下药水，恢复 ${heal} 点生命。`);
  }

  if (state.player.x === state.level.stairs.x && state.player.y === state.level.stairs.y && state.level.enemies.length === 0) {
    state.floor += 1;
    state.player.maxHp += 2;
    state.player.hp = state.player.maxHp;
    setMessage('你进入更深处，生命上限 +2。');
    loadFloor();
  }

  enemyTurn();
  render();
}

function enemyTurn() {
  for (const enemy of state.level.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist === 1) {
      state.player.hp -= enemy.atk;
      setMessage(`敌人反击，造成 ${enemy.atk} 点伤害！`);
      if (state.player.hp <= 0) {
        state.player.hp = 0;
        state.gameOver = true;
        setMessage('你倒下了。按“重新开始”再战。');
        return;
      }
      continue;
    }

    const step = Math.random() < 0.7
      ? {
          x: enemy.x + Math.sign(dx),
          y: enemy.y + (Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy)),
        }
      : {
          x: enemy.x + rand(-1, 1),
          y: enemy.y + rand(-1, 1),
        };

    const blockedByEnemy = state.level.enemies.some(
      (e) => e !== enemy && e.x === step.x && e.y === step.y
    );

    if (
      step.x > 0 && step.y > 0 && step.x < COLS - 1 && step.y < ROWS - 1 &&
      state.level.map[step.y][step.x] === FLOOR &&
      !blockedByEnemy &&
      !(step.x === state.player.x && step.y === state.player.y)
    ) {
      enemy.x = step.x;
      enemy.y = step.y;
    }
  }
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function drawChar(char, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, x * TILE + TILE / 2, y * TILE + TILE / 2 + 1);
}

function render() {
  const { map, enemies, potions, stairs } = state.level;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(x, y, map[y][x] === WALL ? '#383838' : '#141414');
      if (map[y][x] === FLOOR) {
        ctx.strokeStyle = '#1b1b1b';
        ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  drawChar('>', stairs.x, stairs.y, '#ffd166');
  for (const p of potions) drawChar('!', p.x, p.y, '#69ff90');
  for (const e of enemies) drawChar('g', e.x, e.y, '#ff6b6b');
  drawChar('@', state.player.x, state.player.y, '#8be9fd');

  ui.floor.textContent = state.floor;
  ui.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
  ui.atk.textContent = state.player.atk;
  ui.enemies.textContent = state.level.enemies.length;
}

window.addEventListener('keydown', (e) => {
  const map = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0],
  };
  const dir = map[e.key];
  if (!dir) return;
  e.preventDefault();
  movePlayer(dir[0], dir[1]);
});

ui.restart.addEventListener('click', initGame);

initGame();
