const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const characterImage = new Image();

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const powerEl = document.querySelector("#charge");
const startPanel = document.querySelector("#startPanel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreEl = document.querySelector("#finalScore");
const pauseButton = document.querySelector("#pauseButton");
const characterButtons = [...document.querySelectorAll(".character-option")];

const TILE = {
  wall: "#",
  pellet: ".",
  power: "o",
  empty: " ",
};

const LEVEL_MAP = [
  "###################",
  "#o.......#.......o#",
  "#.###.##.#.##.###.#",
  "#.................#",
  "#.###.#.###.#.###.#",
  "#.....#..#..#.....#",
  "#####.## # ##.#####",
  "     .   P   .     ",
  "#####.## # ##.#####",
  "#.....#..#..#.....#",
  "#.###.#.###.#.###.#",
  "#.................#",
  "#.###.##.#.##.###.#",
  "#o.......#.......o#",
  "###################",
];

const directions = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const opposite = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};

const characters = {
  dad: {
    name: "Dad",
    image: "assets/character.png",
  },
  g: {
    name: "G",
    image: "assets/character-luna.png",
  },
  pau: {
    name: "Pau",
    image: "assets/character-maya.png",
  },
};

const savedCharacter = localStorage.getItem("neon-drift-character");
const legacyCharacters = {
  luna: "g",
  maya: "pau",
};
let selectedCharacter = legacyCharacters[savedCharacter] || savedCharacter || "dad";
if (!characters[selectedCharacter]) {
  selectedCharacter = "dad";
}
characterImage.src = characters[selectedCharacter].image;

const board = {
  cols: LEVEL_MAP[0].length,
  rows: LEVEL_MAP.length,
  tileSize: 32,
  offsetX: 0,
  offsetY: 0,
};

const state = {
  running: false,
  paused: false,
  over: false,
  won: false,
  lastTime: 0,
  score: 0,
  best: Number(localStorage.getItem("neon-drift-best") || 0),
  pelletsLeft: 0,
  powerTimer: 0,
  flashTimer: 0,
  level: [],
  particles: [],
};

const player = {
  col: 9,
  row: 7,
  x: 9,
  y: 7,
  direction: "left",
  nextDirection: "left",
  speed: 5.15,
  radius: 0.42,
  invulnerable: 0,
};

const ghostStarts = [
  { col: 7, row: 7, color: "#ff4f8b", direction: "left" },
  { col: 8, row: 7, color: "#3ee8ff", direction: "up" },
  { col: 10, row: 7, color: "#ffca58", direction: "right" },
  { col: 11, row: 7, color: "#b8ff5c", direction: "down" },
];

let ghosts = [];

bestEl.textContent = state.best;
syncCharacterButtons();

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  board.tileSize = Math.floor(Math.min(rect.width / board.cols, rect.height / board.rows));
  board.offsetX = Math.floor((rect.width - board.tileSize * board.cols) / 2);
  board.offsetY = Math.floor((rect.height - board.tileSize * board.rows) / 2);
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.won = false;
  state.lastTime = performance.now();
  state.score = 0;
  state.powerTimer = 0;
  state.flashTimer = 0;
  state.particles = [];
  state.level = LEVEL_MAP.map((row) => row.split(""));
  state.pelletsLeft = state.level.flat().filter((cell) => cell === TILE.pellet || cell === TILE.power).length;

  placeActor(player, 9, 11);
  player.direction = "left";
  player.nextDirection = "left";
  player.invulnerable = 1.4;
  ghosts = ghostStarts.map((ghost, index) => ({
    ...ghost,
    x: ghost.col,
    y: ghost.row,
    startCol: ghost.col,
    startRow: ghost.row,
    speed: 3.45 + index * 0.12,
    eaten: 0,
  }));

  startPanel.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  pauseButton.setAttribute("aria-label", "Pause game");
  pauseButton.title = "Pause";
  pauseButton.firstElementChild.textContent = "II";
  updateHud();
}

function placeActor(actor, col, row) {
  actor.col = col;
  actor.row = row;
  actor.x = col;
  actor.y = row;
}

function selectCharacter(characterId, shouldStart = false) {
  if (!characters[characterId]) return;
  selectedCharacter = characterId;
  characterImage.src = characters[selectedCharacter].image;
  localStorage.setItem("neon-drift-character", selectedCharacter);
  syncCharacterButtons();
  if (shouldStart) {
    resetGame();
  }
}

function syncCharacterButtons() {
  for (const button of characterButtons) {
    const isSelected = button.dataset.character === selectedCharacter;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function showCharacterSelect() {
  state.running = false;
  state.paused = false;
  state.over = false;
  gameOverPanel.classList.add("hidden");
  startPanel.classList.remove("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  bestEl.textContent = state.best;
  powerEl.textContent = state.powerTimer > 0 ? `${Math.ceil(state.powerTimer)}s` : `${state.pelletsLeft}`;
}

function update(delta) {
  if (!state.running || state.paused) return;

  player.invulnerable = Math.max(0, player.invulnerable - delta);
  state.powerTimer = Math.max(0, state.powerTimer - delta);
  state.flashTimer += delta;

  movePlayer(delta);
  eatCurrentTile();
  for (const ghost of ghosts) {
    updateGhost(ghost, delta);
  }
  updateParticles(delta);
  checkGhostCollisions();

  if (state.pelletsLeft === 0) {
    winGame();
  }
  updateHud();
}

function movePlayer(delta) {
  if (canMove(player, player.nextDirection)) {
    player.direction = player.nextDirection;
  }
  moveActor(player, player.direction, player.speed * delta);
}

function updateGhost(ghost, delta) {
  if (ghost.eaten > 0) {
    ghost.eaten = Math.max(0, ghost.eaten - delta);
    return;
  }

  if (isCentered(ghost)) {
    ghost.direction = chooseGhostDirection(ghost);
  }
  moveActor(ghost, ghost.direction, ghost.speed * delta);
}

function chooseGhostDirection(ghost) {
  const options = Object.keys(directions).filter((direction) => {
    if (opposite[direction] === ghost.direction && availableDirections(ghost).length > 1) return false;
    return canMove(ghost, direction);
  });

  if (options.length === 0) return opposite[ghost.direction] || "left";

  if (state.powerTimer > 0) {
    return options.sort((a, b) => distanceAfter(ghost, b) - distanceAfter(ghost, a))[0];
  }

  if (Math.random() < 0.18) {
    return options[Math.floor(Math.random() * options.length)];
  }
  return options.sort((a, b) => distanceAfter(ghost, a) - distanceAfter(ghost, b))[0];
}

function distanceAfter(actor, direction) {
  const vector = directions[direction];
  const nextCol = actor.col + vector.x;
  const nextRow = actor.row + vector.y;
  return Math.hypot(player.x - nextCol, player.y - nextRow);
}

function availableDirections(actor) {
  return Object.keys(directions).filter((direction) => canMove(actor, direction));
}

function moveActor(actor, direction, distance) {
  if (!directions[direction] || !canMove(actor, direction)) {
    actor.x = approach(actor.x, actor.col, distance);
    actor.y = approach(actor.y, actor.row, distance);
    return;
  }

  const vector = directions[direction];
  actor.x += vector.x * distance;
  actor.y += vector.y * distance;

  if (actor.x < -0.55) actor.x = board.cols - 0.45;
  if (actor.x > board.cols - 0.45) actor.x = -0.55;

  const nextCol = Math.round(actor.x);
  const nextRow = Math.round(actor.y);
  if (isOpen(nextCol, nextRow)) {
    actor.col = nextCol;
    actor.row = nextRow;
  }

  if (vector.x !== 0) {
    actor.y = approach(actor.y, actor.row, distance * 1.8);
  }
  if (vector.y !== 0) {
    actor.x = approach(actor.x, actor.col, distance * 1.8);
  }
}

function approach(value, target, amount) {
  if (Math.abs(value - target) <= amount) return target;
  return value + Math.sign(target - value) * amount;
}

function canMove(actor, direction) {
  if (!directions[direction]) return false;
  if (!isCentered(actor)) return direction === actor.direction;
  const vector = directions[direction];
  return isOpen(actor.col + vector.x, actor.row + vector.y);
}

function isCentered(actor) {
  return Math.abs(actor.x - actor.col) < 0.08 && Math.abs(actor.y - actor.row) < 0.08;
}

function isOpen(col, row) {
  const wrappedCol = (col + board.cols) % board.cols;
  if (row < 0 || row >= board.rows) return false;
  return state.level[row]?.[wrappedCol] !== TILE.wall;
}

function eatCurrentTile() {
  const col = Math.round(player.x);
  const row = Math.round(player.y);
  const cell = state.level[row]?.[col];
  if (cell !== TILE.pellet && cell !== TILE.power) return;

  state.level[row][col] = TILE.empty;
  state.pelletsLeft -= 1;
  state.score += cell === TILE.power ? 50 : 10;
  addParticles(col, row, cell === TILE.power ? "#b8ff5c" : "#f2f7fb", cell === TILE.power ? 18 : 5);
  if (cell === TILE.power) {
    state.powerTimer = 8;
  }
}

function checkGhostCollisions() {
  for (const ghost of ghosts) {
    if (ghost.eaten > 0) continue;
    const distance = Math.hypot(player.x - ghost.x, player.y - ghost.y);
    if (distance > 0.58) continue;

    if (state.powerTimer > 0) {
      state.score += 200;
      addParticles(ghost.x, ghost.y, "#ffca58", 24);
      placeActor(ghost, ghost.startCol, ghost.startRow);
      ghost.eaten = 1.6;
      continue;
    }

    if (player.invulnerable <= 0) {
      endGame(false);
      return;
    }
  }
}

function winGame() {
  endGame(true);
}

function endGame(won) {
  state.running = false;
  state.over = true;
  state.won = won;
  addParticles(player.x, player.y, won ? "#b8ff5c" : "#ff4f8b", 34);
  const score = Math.floor(state.score);
  if (score > state.best) {
    state.best = score;
    localStorage.setItem("neon-drift-best", String(state.best));
  }
  finalScoreEl.textContent = won ? `Maze Cleared: ${score}` : `Score ${score}`;
  gameOverPanel.classList.remove("hidden");
  updateHud();
}

function addParticles(col, row, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.1 + 0.8;
    state.particles.push({
      x: col,
      y: row,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.35 + 0.25,
      maxLife: 0.7,
      color,
    });
  }
}

function updateParticles(delta) {
  for (const particle of state.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawBackground(rect.width, rect.height);
  drawMaze();
  drawPellets();
  drawParticles();
  drawGhosts();
  drawPlayer();
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#081017");
  gradient.addColorStop(0.6, "#0d1620");
  gradient.addColorStop(1, "#120f17");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawMaze() {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (state.level[row]?.[col] !== TILE.wall) continue;
      const x = board.offsetX + col * board.tileSize;
      const y = board.offsetY + row * board.tileSize;
      ctx.fillStyle = "#142133";
      roundRect(x + 2, y + 2, board.tileSize - 4, board.tileSize - 4, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(62, 232, 255, 0.42)";
      ctx.lineWidth = 2;
      roundRect(x + 4, y + 4, board.tileSize - 8, board.tileSize - 8, 5);
      ctx.stroke();
    }
  }
}

function drawPellets() {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = state.level[row]?.[col];
      if (cell !== TILE.pellet && cell !== TILE.power) continue;
      const { x, y } = tileToPixel(col, row);
      ctx.beginPath();
      ctx.fillStyle = cell === TILE.power ? "#b8ff5c" : "#f2f7fb";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = cell === TILE.power ? 18 : 5;
      ctx.arc(x, y, cell === TILE.power ? board.tileSize * 0.18 : board.tileSize * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawGhosts() {
  for (const ghost of ghosts) {
    if (ghost.eaten > 0 && Math.floor(state.flashTimer * 12) % 2 === 0) continue;
    const { x, y } = actorToPixel(ghost);
    const vulnerable = state.powerTimer > 0;
    const color = vulnerable ? "#4f6cff" : ghost.color;
    const radius = board.tileSize * 0.36;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.18, radius, Math.PI, 0);
    ctx.lineTo(radius, radius * 0.62);
    for (let i = 0; i < 3; i += 1) {
      const waveX = radius - (i + 0.5) * ((radius * 2) / 3);
      ctx.quadraticCurveTo(waveX, radius * 0.35, waveX - radius / 3, radius * 0.62);
    }
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-radius * 0.34, -radius * 0.12, radius * 0.18, 0, Math.PI * 2);
    ctx.arc(radius * 0.34, -radius * 0.12, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#071014";
    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.1, radius * 0.08, 0, Math.PI * 2);
    ctx.arc(radius * 0.4, -radius * 0.1, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer() {
  const { x, y } = actorToPixel(player);
  const radius = board.tileSize * 0.46;
  const pulse = state.powerTimer > 0 ? Math.sin(state.flashTimer * 18) * 2 : 0;

  ctx.save();
  ctx.translate(x, y);
  if (player.invulnerable > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.58;
  }

  ctx.fillStyle = state.powerTimer > 0 ? "#b8ff5c" : "#ffca58";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(0, 0, radius + pulse, 0, Math.PI * 2);
  ctx.fill();

  if (characterImage.complete && characterImage.naturalWidth > 0) {
    const size = board.tileSize * 0.98;
    ctx.shadowBlur = 0;
    ctx.drawImage(characterImage, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    const { x, y } = tileToPixel(particle.x, particle.y);
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(x, y, board.tileSize * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function tileToPixel(col, row) {
  return {
    x: board.offsetX + (col + 0.5) * board.tileSize,
    y: board.offsetY + (row + 0.5) * board.tileSize,
  };
}

function actorToPixel(actor) {
  return tileToPixel(actor.x, actor.y);
}

function setDirection(direction) {
  if (!directions[direction]) return;
  player.nextDirection = direction;
  if (!state.running && !state.over && startPanel.classList.contains("hidden")) {
    resetGame();
  }
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function loop(time) {
  const delta = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseButton.setAttribute("aria-label", state.paused ? "Resume game" : "Pause game");
  pauseButton.title = state.paused ? "Resume" : "Pause";
  pauseButton.firstElementChild.textContent = state.paused ? "▶" : "II";
  state.lastTime = performance.now();
}

for (const button of characterButtons) {
  button.addEventListener("click", () => selectCharacter(button.dataset.character, true));
}

document.querySelector("#restartButton").addEventListener("click", resetGame);
document.querySelector("#characterSelectButton").addEventListener("click", showCharacterSelect);
document.querySelector("#leftButton").addEventListener("click", () => setDirection("left"));
document.querySelector("#rightButton").addEventListener("click", () => setDirection("right"));
document.querySelector("#upButton").addEventListener("click", () => setDirection("up"));
document.querySelector("#downButton").addEventListener("click", () => setDirection("down"));
pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", (event) => {
  const keyDirections = {
    ArrowLeft: "left",
    a: "left",
    ArrowRight: "right",
    d: "right",
    ArrowUp: "up",
    w: "up",
    ArrowDown: "down",
    s: "down",
  };
  const direction = keyDirections[event.key] || keyDirections[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    setDirection(direction);
  }
  if (event.key.toLowerCase() === "p" || event.key === "Escape") {
    event.preventDefault();
    togglePause();
  }
});

let touchStart = null;
canvas.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDirection(deltaX < 0 ? "left" : "right");
    } else {
      setDirection(deltaY < 0 ? "up" : "down");
    }
    touchStart = null;
  },
  { passive: true },
);

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
state.level = LEVEL_MAP.map((row) => row.split(""));
state.pelletsLeft = state.level.flat().filter((cell) => cell === TILE.pellet || cell === TILE.power).length;
updateHud();
requestAnimationFrame(loop);
