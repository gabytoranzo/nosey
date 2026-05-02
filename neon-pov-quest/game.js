const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const characterImage = new Image();

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const missionEl = document.querySelector("#charge");
const startPanel = document.querySelector("#startPanel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreEl = document.querySelector("#finalScore");
const pauseButton = document.querySelector("#pauseButton");
const characterButtons = [...document.querySelectorAll(".character-option")];

const githubUrl = "https://github.com/gabytoranzo/nosey/tree/main/neon-pov-quest";
const gravity = 42;
const friction = 0.82;
const levelWidth = 3000;
const levelHeight = 720;

const characters = {
  dad: { name: "Dad", image: "assets/character.png", tint: "#3ee8ff" },
  g: { name: "G", image: "assets/character-luna.png", tint: "#b8ff5c" },
  pau: { name: "Pau", image: "assets/character-maya.png", tint: "#ffca58" },
};

const savedCharacter = localStorage.getItem("neon-pov-character");
let selectedCharacter = characters[savedCharacter] ? savedCharacter : "dad";
characterImage.src = characters[selectedCharacter].image;

const platforms = [
  { x: 0, y: 660, w: 500, h: 60, kind: "stone" },
  { x: 565, y: 610, w: 210, h: 28, kind: "moss" },
  { x: 845, y: 550, w: 180, h: 28, kind: "stone" },
  { x: 1090, y: 490, w: 155, h: 28, kind: "moss" },
  { x: 1310, y: 600, w: 310, h: 28, kind: "stone" },
  { x: 1705, y: 540, w: 185, h: 28, kind: "stone" },
  { x: 1960, y: 470, w: 185, h: 28, kind: "moss" },
  { x: 2220, y: 585, w: 220, h: 28, kind: "stone" },
  { x: 2520, y: 660, w: 480, h: 60, kind: "stone" },
  { x: 735, y: 430, w: 120, h: 22, kind: "ghost" },
  { x: 1510, y: 430, w: 128, h: 22, kind: "ghost" },
  { x: 2325, y: 410, w: 130, h: 22, kind: "ghost" },
];

const crystals = [
  { x: 640, y: 555, taken: false },
  { x: 920, y: 495, taken: false },
  { x: 1158, y: 435, taken: false },
  { x: 1510, y: 545, taken: false },
  { x: 1792, y: 485, taken: false },
  { x: 2048, y: 415, taken: false },
  { x: 2320, y: 530, taken: false },
  { x: 2660, y: 605, taken: false },
];

const hazards = [
  { x: 505, y: 648, w: 58, h: 18, phase: 0 },
  { x: 790, y: 598, w: 54, h: 18, phase: 1.3 },
  { x: 1260, y: 648, w: 48, h: 18, phase: 0.5 },
  { x: 1648, y: 648, w: 52, h: 18, phase: 2.4 },
  { x: 2182, y: 648, w: 42, h: 18, phase: 1.8 },
  { x: 2462, y: 648, w: 54, h: 18, phase: 0.9 },
];

const switches = [
  { x: 1388, y: 570, w: 62, h: 18, pressed: false },
  { x: 2572, y: 630, w: 62, h: 18, pressed: false },
];

const movingPlatforms = [
  { x: 318, y: 520, w: 150, h: 24, baseX: 318, baseY: 520, range: 110, speed: 1.25 },
  { x: 1885, y: 610, w: 145, h: 24, baseX: 1885, baseY: 610, range: 138, speed: 1.1 },
];

const gate = { x: 2865, y: 552, w: 54, h: 108 };
const keys = { left: false, right: false, up: false };
const camera = { x: 0, y: 0, width: canvas.clientWidth, height: canvas.clientHeight };

const state = {
  running: false,
  paused: false,
  over: false,
  won: false,
  lastTime: 0,
  time: 0,
  score: 0,
  best: Number(localStorage.getItem("neon-pov-best") || 0),
  particles: [],
};

const player = {
  x: 80,
  y: 560,
  w: 42,
  h: 58,
  vx: 0,
  vy: 0,
  onGround: false,
  jumps: 0,
  direction: 1,
  safeX: 80,
  safeY: 560,
  hurtTimer: 0,
};

bestEl.textContent = state.best;
syncCharacterButtons();
document.querySelector("#githubLink").href = githubUrl;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.width = rect.width;
  camera.height = rect.height;
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.won = false;
  state.lastTime = performance.now();
  state.time = 0;
  state.score = 0;
  state.particles = [];

  for (const crystal of crystals) crystal.taken = false;
  for (const switchPad of switches) switchPad.pressed = false;
  placePlayer(80, 560);
  player.vx = 0;
  player.vy = 0;
  player.direction = 1;
  player.hurtTimer = 0;

  startPanel.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  pauseButton.setAttribute("aria-label", "Pause game");
  pauseButton.title = "Pause";
  pauseButton.firstElementChild.textContent = "II";
  updateHud();
}

function placePlayer(x, y) {
  player.x = x;
  player.y = y;
  player.safeX = x;
  player.safeY = y;
}

function selectCharacter(characterId, shouldStart = false) {
  if (!characters[characterId]) return;
  selectedCharacter = characterId;
  characterImage.src = characters[selectedCharacter].image;
  localStorage.setItem("neon-pov-character", selectedCharacter);
  syncCharacterButtons();
  if (shouldStart) resetGame();
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
  const taken = crystals.filter((crystal) => crystal.taken).length;
  scoreEl.textContent = Math.floor(state.score);
  bestEl.textContent = state.best;
  missionEl.textContent = `${taken}/${crystals.length}`;
}

function update(delta) {
  if (!state.running || state.paused) return;

  state.time += delta;
  player.hurtTimer = Math.max(0, player.hurtTimer - delta);
  updateMovingPlatforms();
  updatePlayer(delta);
  collectCrystals();
  updateSwitches();
  updateParticles(delta);
  updateCamera();

  if (touchingHazard() || player.y > levelHeight + 80) respawnPlayer();
  if (rectsOverlap(player, gate) && allCrystalsTaken() && switches.every((switchPad) => switchPad.pressed)) {
    endGame(true);
  }

  state.score = Math.max(0, Math.floor(crystals.filter((crystal) => crystal.taken).length * 100 + state.time * 3));
  updateHud();
}

function updateMovingPlatforms() {
  for (const platform of movingPlatforms) {
    platform.x = platform.baseX + Math.sin(state.time * platform.speed) * platform.range;
  }
}

function updatePlayer(delta) {
  const previousX = player.x;
  const previousY = player.y;
  const acceleration = player.onGround ? 64 : 42;

  if (keys.left) {
    player.vx -= acceleration * delta;
    player.direction = -1;
  }
  if (keys.right) {
    player.vx += acceleration * delta;
    player.direction = 1;
  }
  if (!keys.left && !keys.right && player.onGround) {
    player.vx *= Math.pow(friction, delta * 60);
  }

  player.vx = clamp(player.vx, -6.2, 6.2);
  player.vy += gravity * delta;

  player.x += player.vx * delta * 60;
  resolveHorizontal(previousX);
  player.y += player.vy * delta * 60;
  resolveVertical(previousY);
  player.x = clamp(player.x, 0, levelWidth - player.w);

  if (player.onGround) {
    player.safeX = player.x;
    player.safeY = player.y;
  }
}

function resolveHorizontal(previousX) {
  for (const platform of solidPlatforms()) {
    if (!rectsOverlap(player, platform)) continue;
    if (previousX + player.w <= platform.x) player.x = platform.x - player.w;
    else if (previousX >= platform.x + platform.w) player.x = platform.x + platform.w;
    player.vx = 0;
  }
}

function resolveVertical(previousY) {
  player.onGround = false;
  for (const platform of solidPlatforms()) {
    if (!rectsOverlap(player, platform)) continue;

    if (previousY + player.h <= platform.y) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumps = 0;
      if (movingPlatforms.includes(platform)) {
        player.x += Math.cos(state.time * platform.speed) * platform.range * platform.speed * 0.016;
      }
    } else if (previousY >= platform.y + platform.h) {
      player.y = platform.y + platform.h;
      player.vy = Math.max(0, player.vy);
    }
  }
}

function solidPlatforms() {
  return [...platforms, ...movingPlatforms];
}

function jump() {
  if (!state.running && !state.over && startPanel.classList.contains("hidden")) resetGame();
  if (!state.running || state.paused) return;
  if (player.onGround || player.jumps < 1) {
    player.vy = -15.8;
    player.onGround = false;
    player.jumps += 1;
    addParticles(player.x + player.w / 2, player.y + player.h, characters[selectedCharacter].tint, 12);
  }
}

function collectCrystals() {
  for (const crystal of crystals) {
    if (crystal.taken) continue;
    const distance = Math.hypot(player.x + player.w / 2 - crystal.x, player.y + player.h / 2 - crystal.y);
    if (distance > 42) continue;
    crystal.taken = true;
    addParticles(crystal.x, crystal.y, "#f2f7fb", 24);
  }
}

function updateSwitches() {
  for (const switchPad of switches) {
    if (switchPad.pressed) continue;
    const switchBody = { x: switchPad.x, y: switchPad.y - 8, w: switchPad.w, h: switchPad.h + 10 };
    if (rectsOverlap(player, switchBody)) {
      switchPad.pressed = true;
      addParticles(switchPad.x + switchPad.w / 2, switchPad.y, "#b8ff5c", 22);
    }
  }
}

function touchingHazard() {
  return hazards.some((hazard) => rectsOverlap(player, hazard));
}

function respawnPlayer() {
  if (!state.running || player.hurtTimer > 0) return;
  player.hurtTimer = 1.2;
  player.x = player.safeX;
  player.y = player.safeY - 8;
  player.vx = 0;
  player.vy = -5;
  addParticles(player.x + player.w / 2, player.y + player.h / 2, "#ff4f8b", 32);
}

function allCrystalsTaken() {
  return crystals.every((crystal) => crystal.taken);
}

function endGame(won) {
  state.running = false;
  state.over = true;
  state.won = won;
  const score = Math.floor(state.score + (won ? 600 : 0));
  state.score = score;
  if (score > state.best) {
    state.best = score;
    localStorage.setItem("neon-pov-best", String(state.best));
  }
  finalScoreEl.textContent = won ? `Mission Complete: ${score}` : `Mission Score ${score}`;
  gameOverPanel.classList.remove("hidden");
  updateHud();
}

function addParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.35 + 0.35,
      maxLife: 0.7,
      color,
    });
  }
}

function updateParticles(delta) {
  for (const particle of state.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta * 20;
    particle.y += particle.vy * delta * 20;
    particle.vy += 18 * delta;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateCamera() {
  const targetX = player.x + player.w / 2 - camera.width * 0.42;
  const targetY = player.y + player.h / 2 - camera.height * 0.56;
  camera.x += (clamp(targetX, 0, levelWidth - camera.width) - camera.x) * 0.12;
  camera.y += (clamp(targetY, 0, Math.max(0, levelHeight - camera.height)) - camera.y) * 0.12;
}

function draw() {
  ctx.clearRect(0, 0, camera.width, camera.height);
  drawSky();
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawWorld();
  ctx.restore();
  if (state.paused) drawPauseLabel();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, camera.height);
  gradient.addColorStop(0, "#102638");
  gradient.addColorStop(0.5, "#1b3646");
  gradient.addColorStop(1, "#17212b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, camera.width, camera.height);

  ctx.fillStyle = "rgba(242, 247, 251, 0.34)";
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 173 + state.time * 12) % (camera.width + 120) - 60;
    const y = (i * 67) % Math.max(1, camera.height * 0.62);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawWorld() {
  drawBackdrops();
  drawPlatforms();
  drawSwitches();
  drawCrystals();
  drawHazards();
  drawGate();
  drawParticles();
  drawPlayer();
}

function drawBackdrops() {
  ctx.fillStyle = "#203242";
  for (let i = 0; i < 11; i += 1) {
    const x = i * 310 - 40;
    const height = 170 + (i % 3) * 44;
    ctx.fillRect(x, 660 - height, 210, height);
    ctx.fillStyle = i % 2 ? "#294557" : "#203242";
  }
  ctx.fillStyle = "#18232d";
  ctx.fillRect(0, 704, levelWidth, 70);
}

function drawPlatforms() {
  for (const platform of solidPlatforms()) {
    const fill = platform.kind === "moss" ? "#3d704a" : platform.kind === "ghost" ? "#426788" : "#4b5664";
    ctx.fillStyle = fill;
    roundRect(platform.x, platform.y, platform.w, platform.h, 7);
    ctx.fill();
    ctx.fillStyle = platform.kind === "ghost" ? "rgba(126, 239, 255, 0.9)" : "#c3d2dd";
    ctx.fillRect(platform.x + 8, platform.y + 5, platform.w - 16, 3);
  }
}

function drawSwitches() {
  for (const switchPad of switches) {
    ctx.fillStyle = switchPad.pressed ? "#b8ff5c" : "#ffca58";
    roundRect(switchPad.x, switchPad.y, switchPad.w, switchPad.h, 7);
    ctx.fill();
    ctx.fillStyle = "rgba(7, 16, 20, 0.32)";
    ctx.fillRect(switchPad.x + 10, switchPad.y + 6, switchPad.w - 20, 4);
  }
}

function drawCrystals() {
  for (const crystal of crystals) {
    if (crystal.taken) continue;
    const bob = Math.sin(state.time * 4 + crystal.x) * 5;
    ctx.save();
    ctx.translate(crystal.x, crystal.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#f2f7fb";
    ctx.shadowColor = "#3ee8ff";
    ctx.shadowBlur = 22;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

function drawHazards() {
  for (const hazard of hazards) {
    const pulse = Math.sin(state.time * 6 + hazard.phase) * 0.24 + 0.76;
    ctx.fillStyle = `rgba(255, 79, 139, ${pulse})`;
    roundRect(hazard.x, hazard.y, hazard.w, hazard.h, 4);
    ctx.fill();
    for (let x = hazard.x + 6; x < hazard.x + hazard.w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, hazard.y);
      ctx.lineTo(x + 7, hazard.y - 22);
      ctx.lineTo(x + 14, hazard.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawGate() {
  const ready = allCrystalsTaken() && switches.every((switchPad) => switchPad.pressed);
  ctx.fillStyle = ready ? "rgba(184, 255, 92, 0.2)" : "rgba(255, 79, 139, 0.16)";
  roundRect(gate.x - 10, gate.y - 22, gate.w + 20, gate.h + 22, 8);
  ctx.fill();
  ctx.strokeStyle = ready ? "#b8ff5c" : "#ff4f8b";
  ctx.lineWidth = 5;
  roundRect(gate.x, gate.y, gate.w, gate.h, 8);
  ctx.stroke();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.direction, 1);

  if (player.hurtTimer > 0 && Math.floor(state.time * 20) % 2 === 0) ctx.globalAlpha = 0.55;

  ctx.fillStyle = characters[selectedCharacter].tint;
  ctx.shadowColor = characters[selectedCharacter].tint;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(0, 3, player.w * 0.62, player.h * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  if (characterImage.complete && characterImage.naturalWidth > 0) {
    const spriteSize = Math.max(player.w, player.h) * 1.2;
    ctx.shadowBlur = 0;
    ctx.drawImage(characterImage, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPauseLabel() {
  ctx.fillStyle = "rgba(7, 11, 16, 0.72)";
  ctx.fillRect(0, 0, camera.width, camera.height);
  ctx.fillStyle = "#f2f7fb";
  ctx.font = "900 36px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Paused", camera.width / 2, camera.height / 2);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function setMove(direction, isPressed) {
  keys[direction] = isPressed;
}

for (const button of characterButtons) {
  button.addEventListener("click", () => selectCharacter(button.dataset.character, true));
}

document.querySelector("#restartButton").addEventListener("click", resetGame);
document.querySelector("#characterSelectButton").addEventListener("click", showCharacterSelect);
document.querySelector("#leftButton").addEventListener("pointerdown", () => setMove("left", true));
document.querySelector("#leftButton").addEventListener("pointerup", () => setMove("left", false));
document.querySelector("#leftButton").addEventListener("pointerleave", () => setMove("left", false));
document.querySelector("#rightButton").addEventListener("pointerdown", () => setMove("right", true));
document.querySelector("#rightButton").addEventListener("pointerup", () => setMove("right", false));
document.querySelector("#rightButton").addEventListener("pointerleave", () => setMove("right", false));
document.querySelector("#upButton").addEventListener("click", jump);
document.querySelector("#downButton").addEventListener("click", respawnPlayer);
pauseButton.addEventListener("click", togglePause);

window.addEventListener("pointerup", () => {
  setMove("left", false);
  setMove("right", false);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    setMove("left", true);
  }
  if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    setMove("right", true);
  }
  if (event.key === "ArrowUp" || key === "w" || event.key === " ") {
    event.preventDefault();
    if (!keys.up) jump();
    keys.up = true;
  }
  if (key === "r") {
    event.preventDefault();
    respawnPlayer();
  }
  if (key === "p" || event.key === "Escape") {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") setMove("left", false);
  if (event.key === "ArrowRight" || key === "d") setMove("right", false);
  if (event.key === "ArrowUp" || key === "w" || event.key === " ") keys.up = false;
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
    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -20) {
      jump();
    } else if (Math.abs(deltaX) > 24) {
      player.vx += deltaX > 0 ? 2.8 : -2.8;
      player.direction = deltaX > 0 ? 1 : -1;
    }
    touchStart = null;
  },
  { passive: true },
);

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
updateHud();
updateCamera();
requestAnimationFrame(loop);
