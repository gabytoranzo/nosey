const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const chargeEl = document.querySelector("#charge");
const startPanel = document.querySelector("#startPanel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreEl = document.querySelector("#finalScore");
const pauseButton = document.querySelector("#pauseButton");

const state = {
  running: false,
  paused: false,
  over: false,
  lastTime: 0,
  spawnTimer: 0,
  cellTimer: 0,
  score: 0,
  best: Number(localStorage.getItem("neon-drift-best") || 0),
  speed: 350,
  charge: 0,
  shake: 0,
  objects: [],
  particles: [],
  stars: [],
  keys: new Set(),
};

const player = {
  x: 0,
  y: 0,
  radius: 19,
  targetX: 0,
  lane: 1,
  invulnerable: 0,
};

const lanes = [0.25, 0.5, 0.75];

bestEl.textContent = state.best;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  player.y = rect.height - 88;
  setLane(player.lane, true);
  buildStars(rect.width, rect.height);
}

function buildStars(width, height) {
  state.stars = Array.from({ length: Math.floor((width * height) / 5200) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 80 + 35,
    hue: Math.random() > 0.6 ? "62, 232, 255" : "255, 255, 255",
  }));
}

function setLane(lane, snap = false) {
  const rect = canvas.getBoundingClientRect();
  player.lane = Math.max(0, Math.min(lanes.length - 1, lane));
  player.targetX = rect.width * lanes[player.lane];
  if (snap) {
    player.x = player.targetX;
  }
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.over = false;
  state.lastTime = performance.now();
  state.spawnTimer = 0;
  state.cellTimer = 0.6;
  state.score = 0;
  state.speed = 350;
  state.charge = 0;
  state.shake = 0;
  state.objects = [];
  state.particles = [];
  player.invulnerable = 1.2;
  setLane(1, true);
  startPanel.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  pauseButton.setAttribute("aria-label", "Pause game");
  pauseButton.title = "Pause";
  pauseButton.firstElementChild.textContent = "II";
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  bestEl.textContent = state.best;
  chargeEl.textContent = `${Math.floor(state.charge)}%`;
}

function spawnObstacle() {
  const rect = canvas.getBoundingClientRect();
  const lane = Math.floor(Math.random() * lanes.length);
  const width = Math.min(90, rect.width * 0.18);
  state.objects.push({
    type: "drone",
    x: rect.width * lanes[lane],
    y: -60,
    width,
    height: 48,
    lane,
    drift: (Math.random() - 0.5) * 20,
  });
}

function spawnCell() {
  const rect = canvas.getBoundingClientRect();
  const lane = Math.floor(Math.random() * lanes.length);
  state.objects.push({
    type: "cell",
    x: rect.width * lanes[lane],
    y: -42,
    radius: 15,
    lane,
    spin: 0,
  });
}

function addParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 190 + 50;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 0.45 + 0.28,
      maxLife: 0.75,
      color,
    });
  }
}

function pulse() {
  if (!state.running || state.paused || state.charge < 100) return;
  const rect = canvas.getBoundingClientRect();
  state.charge = 0;
  state.shake = 0.18;
  state.objects = state.objects.filter((object) => {
    const hit = object.type === "drone" && Math.abs(object.y - player.y) < rect.height * 0.72;
    if (hit) {
      addParticles(object.x, object.y, "#ffca58", 18);
      state.score += 80;
    }
    return !hit;
  });
}

function update(delta) {
  if (!state.running || state.paused) return;

  const rect = canvas.getBoundingClientRect();
  state.score += delta * 24;
  state.speed += delta * 8;
  state.spawnTimer -= delta;
  state.cellTimer -= delta;
  state.shake = Math.max(0, state.shake - delta);
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  player.x += (player.targetX - player.x) * Math.min(1, delta * 12);

  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(0.36, 1.05 - state.score / 5500);
  }

  if (state.cellTimer <= 0) {
    spawnCell();
    state.cellTimer = Math.max(0.7, 1.5 - state.score / 7000);
  }

  for (const star of state.stars) {
    star.y += star.speed * delta;
    if (star.y > rect.height) {
      star.y = -4;
      star.x = Math.random() * rect.width;
    }
  }

  for (const object of state.objects) {
    object.y += state.speed * delta;
    if (object.type === "drone") {
      object.x += Math.sin((object.y + object.lane * 80) * 0.02) * object.drift * delta;
    } else {
      object.spin += delta * 7;
    }
  }

  state.objects = state.objects.filter((object) => object.y < rect.height + 90);

  for (const particle of state.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  checkCollisions();
  updateHud();
}

function checkCollisions() {
  for (const object of state.objects) {
    if (object.type === "cell") {
      const distance = Math.hypot(player.x - object.x, player.y - object.y);
      if (distance < player.radius + object.radius) {
        state.charge = Math.min(100, state.charge + 22);
        state.score += 45;
        addParticles(object.x, object.y, "#b8ff5c", 10);
        object.y = Number.POSITIVE_INFINITY;
      }
      continue;
    }

    if (player.invulnerable > 0) continue;
    const halfW = object.width / 2;
    const halfH = object.height / 2;
    const closestX = Math.max(object.x - halfW, Math.min(player.x, object.x + halfW));
    const closestY = Math.max(object.y - halfH, Math.min(player.y, object.y + halfH));
    const distance = Math.hypot(player.x - closestX, player.y - closestY);
    if (distance < player.radius) {
      endGame();
      return;
    }
  }
}

function endGame() {
  state.running = false;
  state.over = true;
  state.shake = 0.4;
  addParticles(player.x, player.y, "#ff4f8b", 34);
  const score = Math.floor(state.score);
  if (score > state.best) {
    state.best = score;
    localStorage.setItem("neon-drift-best", String(state.best));
  }
  finalScoreEl.textContent = `Score ${score}`;
  gameOverPanel.classList.remove("hidden");
  updateHud();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const offsetX = state.shake ? (Math.random() - 0.5) * state.shake * 18 : 0;
  const offsetY = state.shake ? (Math.random() - 0.5) * state.shake * 18 : 0;
  ctx.save();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.translate(offsetX, offsetY);
  drawBackground(rect.width, rect.height);
  drawTrack(rect.width, rect.height);
  drawObjects();
  drawPlayer();
  drawParticles();
  ctx.restore();
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#091018");
  gradient.addColorStop(0.56, "#0d1620");
  gradient.addColorStop(1, "#100d14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const star of state.stars) {
    ctx.fillStyle = `rgba(${star.hue}, 0.58)`;
    ctx.fillRect(star.x, star.y, star.size, star.size * 2.8);
  }
}

function drawTrack(width, height) {
  ctx.lineWidth = 2;
  for (const lane of lanes) {
    const x = width * lane;
    ctx.strokeStyle = "rgba(62, 232, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = (performance.now() * 0.18) % 70; y < height; y += 70) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(width * 0.13, y);
    ctx.lineTo(width * 0.87, y + 26);
    ctx.stroke();
  }
}

function drawObjects() {
  for (const object of state.objects) {
    if (object.type === "cell") {
      ctx.save();
      ctx.translate(object.x, object.y);
      ctx.rotate(object.spin);
      ctx.fillStyle = "#b8ff5c";
      ctx.shadowColor = "#b8ff5c";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(14, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(-14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.fillStyle = "#ff4f8b";
    ctx.shadowColor = "#ff4f8b";
    ctx.shadowBlur = 18;
    roundRect(-object.width / 2, -object.height / 2, object.width, object.height, 8);
    ctx.fill();
    ctx.fillStyle = "#240912";
    roundRect(-object.width / 4, -7, object.width / 2, 14, 5);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnerable > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.52;
  }
  ctx.shadowColor = "#3ee8ff";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#3ee8ff";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(22, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(-22, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#071014";
  ctx.beginPath();
  ctx.arc(0, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
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

function moveLeft() {
  if (state.running && !state.paused) setLane(player.lane - 1);
}

function moveRight() {
  if (state.running && !state.paused) setLane(player.lane + 1);
}

document.querySelector("#startButton").addEventListener("click", resetGame);
document.querySelector("#restartButton").addEventListener("click", resetGame);
document.querySelector("#leftButton").addEventListener("click", moveLeft);
document.querySelector("#rightButton").addEventListener("click", moveRight);
document.querySelector("#pulseButton").addEventListener("click", pulse);
pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    moveLeft();
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    moveRight();
  }
  if (event.key === " " || event.key.toLowerCase() === "w" || event.key === "ArrowUp") {
    event.preventDefault();
    pulse();
  }
  if (event.key.toLowerCase() === "p" || event.key === "Escape") {
    event.preventDefault();
    togglePause();
  }
});

let touchStartX = 0;
canvas.addEventListener(
  "touchstart",
  (event) => {
    touchStartX = event.changedTouches[0].clientX;
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (event) => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) < 24) {
      pulse();
    } else if (deltaX < 0) {
      moveLeft();
    } else {
      moveRight();
    }
  },
  { passive: true },
);

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);
