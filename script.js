const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('score-value');
const highscoreValue = document.getElementById('highscore-value');
const difficultySelect = document.getElementById('difficulty-select');
const difficultyDescription = document.getElementById('difficulty-description');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const submitScoreButton = document.getElementById('submit-score-button');
const playAgainButton = document.getElementById('play-again-button');
const finalScore = document.getElementById('final-score');
const playerNameInput = document.getElementById('player-name');
const rankingList = document.getElementById('ranking-list');

const RANKING_KEY = 'avoid-game-ranking';
const HIGHSCORE_KEY = 'avoid-game-highscore';

const difficulties = {
  easy: {
    label: '쉬움',
    description: '초원 배경, 적은 공격 빈도, 낮은 속도.',
    spawnInterval: 1700,
    attackSpeed: 90,
    worldSpeed: 80,
    scoreMultiplier: 1,
    theme: 'meadow',
  },
  normal: {
    label: '보통',
    description: '정글 배경, 중간 공격 빈도, 적당한 속도.',
    spawnInterval: 1200,
    attackSpeed: 120,
    worldSpeed: 110,
    scoreMultiplier: 1.2,
    theme: 'jungle',
  },
  hard: {
    label: '어려움',
    description: '지옥 배경, 높은 공격 빈도, 빠른 속도.',
    spawnInterval: 850,
    attackSpeed: 160,
    worldSpeed: 150,
    scoreMultiplier: 1.5,
    theme: 'hell',
  },
};

const gameState = {
  running: false,
  attacks: [],
  target: { x: 0, y: 0 },
  playerDirection: { x: 0, y: -1 },
  spawnTimer: 0,
  lastTimestamp: 0,
  elapsed: 0,
  score: 0,
  difficulty: 'easy',
  worldOffset: { x: 0, y: 0 },
};

const player = {
  x: 450,
  y: 300,
  radius: 18,
};

let rankingData = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = 900;
  const height = 600;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function setDifficultyClass(name) {
  document.body.classList.remove('difficulty-easy', 'difficulty-normal', 'difficulty-hard');
  document.body.classList.add(`difficulty-${name}`);
}

function updateDifficultyDescription() {
  const difficulty = difficulties[difficultySelect.value];
  difficultyDescription.textContent = difficulty.description;
}

function loadRanking() {
  try {
    rankingData = JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  } catch {
    rankingData = [];
  }
}

function saveRanking() {
  localStorage.setItem(RANKING_KEY, JSON.stringify(rankingData));
}

function updateRankingList() {
  rankingList.innerHTML = '';
  rankingData.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `${entry.name}`;
    const scoreLabel = document.createElement('strong');
    scoreLabel.textContent = entry.score;
    item.appendChild(scoreLabel);
    rankingList.appendChild(item);
  });
}

function getHighscore() {
  return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
}

function saveHighscore(score) {
  const currentHighscore = getHighscore();
  if (score > currentHighscore) {
    localStorage.setItem(HIGHSCORE_KEY, score);
    highscoreValue.textContent = score;
  }
}

function resetGameState() {
  gameState.running = false;
  gameState.attacks = [];
  gameState.target = { x: 0, y: 0 };
  gameState.playerDirection = { x: 0, y: -1 };
  gameState.spawnTimer = 0;
  gameState.lastTimestamp = 0;
  gameState.elapsed = 0;
  gameState.score = 0;
  gameState.worldOffset = { x: 0, y: 0 };
}

function openStartOverlay() {
  startOverlay.classList.remove('hidden');
  gameOverOverlay.classList.add('hidden');
  updateDifficultyDescription();
}

function openGameOverOverlay() {
  finalScore.textContent = gameState.score;
  playerNameInput.value = '';
  gameOverOverlay.classList.remove('hidden');
}

function createAttack() {
  const width = 900;
  const height = 600;
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = Math.random() * width;
    y = -28;
  } else if (edge === 1) {
    x = width + 28;
    y = Math.random() * height;
  } else if (edge === 2) {
    x = Math.random() * width;
    y = height + 28;
  } else {
    x = -28;
    y = Math.random() * height;
  }

  const difficulty = difficulties[gameState.difficulty];
  const typeSeed = Math.random();
  const attack = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 14,
    active: true,
    age: 0,
    type: 'projectile',
    color: '#ff7b78',
    speed: difficulty.attackSpeed + Math.random() * 20,
  };

  if (typeSeed < 0.4) {
    attack.type = 'projectile';
    attack.color = '#ff7b78';
  } else if (typeSeed < 0.75) {
    attack.type = 'homing';
    attack.color = '#ffd560';
    attack.radius = 16;
  } else {
    attack.type = 'mine';
    attack.color = '#ffb876';
    attack.radius = 18;
    attack.active = false;
    attack.activation = 1100 + Math.random() * 600;
    attack.vx = 0;
    attack.vy = 0;
  }

  const angle = Math.atan2(player.y - y, player.x - x);
  attack.vx = Math.cos(angle) * attack.speed;
  attack.vy = Math.sin(angle) * attack.speed;

  gameState.attacks.push(attack);
}

function updateScore() {
  const difficulty = difficulties[gameState.difficulty];
  gameState.score = Math.max(
    gameState.score,
    Math.floor(gameState.elapsed * 10 * difficulty.scoreMultiplier),
  );
  scoreValue.textContent = gameState.score;
}

function updateAttack(ai, dtSeconds, worldVelocity) {
  if (ai.type === 'homing') {
    const dx = player.x - ai.x;
    const dy = player.y - ai.y;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const homingSpeed = difficulties[gameState.difficulty].attackSpeed * 0.8;
    ai.vx = (dx / distance) * homingSpeed;
    ai.vy = (dy / distance) * homingSpeed;
  }

  if (ai.type === 'mine') {
    ai.age += dtSeconds * 1000;
    if (!ai.active && ai.age >= ai.activation) {
      ai.active = true;
    }
  }

  ai.x += (ai.vx + worldVelocity.x) * dtSeconds;
  ai.y += (ai.vy + worldVelocity.y) * dtSeconds;
}

function isAttackOnScreen(ai) {
  return ai.x >= -120 && ai.x <= 900 + 120 && ai.y >= -120 && ai.y <= 600 + 120;
}

function checkCollision(ai) {
  const distance = Math.hypot(ai.x - player.x, ai.y - player.y);
  return distance < ai.radius + player.radius;
}

function updateGame(deltaTime) {
  const dtSeconds = deltaTime / 1000;
  const difficulty = difficulties[gameState.difficulty];

  const worldVelocity = {
    x: -gameState.target.x * difficulty.worldSpeed,
    y: -gameState.target.y * difficulty.worldSpeed,
  };

  gameState.elapsed += deltaTime;
  gameState.spawnTimer += deltaTime;

  if (gameState.spawnTimer >= difficulty.spawnInterval) {
    createAttack();
    gameState.spawnTimer -= difficulty.spawnInterval;
  }

  gameState.worldOffset.x += worldVelocity.x * dtSeconds;
  gameState.worldOffset.y += worldVelocity.y * dtSeconds;

  gameState.attacks = gameState.attacks.filter((attack) => {
    updateAttack(attack, dtSeconds, worldVelocity);
    if (!isAttackOnScreen(attack)) {
      return false;
    }

    if (attack.type === 'mine' && !attack.active) {
      return true;
    }

    if (checkCollision(attack)) {
      endGame();
      return false;
    }

    return true;
  });

  updateScore();
}

function drawBackground() {
  const { x: offsetX, y: offsetY } = gameState.worldOffset;
  const width = 900;
  const height = 600;
  const difficulty = gameState.difficulty;

  let gradient;
  if (difficulty === 'easy') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a3a23');
    gradient.addColorStop(1, '#0b1610');
  } else if (difficulty === 'normal') {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#16321f');
    gradient.addColorStop(1, '#0b120c');
  } else {
    gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#37100d');
    gradient.addColorStop(1, '#080509');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const count = 45;
  for (let i = 0; i < count; i += 1) {
    const x = ((i * 198 + offsetX * 0.52) % width + width) % width;
    const y = ((i * 127 + offsetY * 0.38) % height + height) % height;
    if (difficulty === 'easy') {
      ctx.fillStyle = 'rgba(115, 214, 154, 0.12)';
      ctx.beginPath();
      ctx.ellipse(x, y, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(94, 196, 143, 0.22)';
      ctx.fillRect(x + 2, y + 6, 3, 14);
    } else if (difficulty === 'normal') {
      ctx.fillStyle = 'rgba(166, 212, 111, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(171, 213, 130, 0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 16, y + 4);
      ctx.lineTo(x + 16, y + 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 136, 67, 0.12)';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 107, 64, 0.22)';
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x + 6, y + 10);
      ctx.lineTo(x - 6, y + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (difficulty === 'hard') {
    for (let i = 0; i < 8; i += 1) {
      const x = ((i * 132 + offsetX * 0.35) % width + width) % width;
      const y = ((i * 88 + offsetY * 0.45) % height + height) % height;
      ctx.strokeStyle = 'rgba(255, 77, 37, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.bezierCurveTo(x + 14, y - 6, x + 10, y + 12, x, y + 18);
      ctx.bezierCurveTo(x - 10, y + 12, x - 14, y - 6, x, y - 16);
      ctx.stroke();
    }
  }
}

function drawPlayer() {
  const angle = Math.atan2(gameState.playerDirection.y, gameState.playerDirection.x);
  const base = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, player.radius);
  base.addColorStop(0, '#e9f7ff');
  base.addColorStop(0.35, '#6cf0ff');
  base.addColorStop(1, 'rgba(72, 158, 195, 0.18)');

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -player.radius * 0.8);
  ctx.lineTo(player.radius * 0.5, player.radius * 0.6);
  ctx.lineTo(0, player.radius * 0.3);
  ctx.lineTo(-player.radius * 0.5, player.radius * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAttack(attack) {
  ctx.save();
  if (attack.type === 'mine') {
    ctx.globalAlpha = attack.active ? 1 : 0.55;
    ctx.fillStyle = attack.color;
    ctx.beginPath();
    ctx.arc(attack.x, attack.y, attack.radius, 0, Math.PI * 2);
    ctx.fill();
    if (!attack.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(attack.x, attack.y, attack.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = attack.color;
    ctx.beginPath();
    ctx.arc(attack.x, attack.y, attack.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGame() {
  ctx.clearRect(0, 0, 900, 600);
  drawBackground();
  gameState.attacks.forEach(drawAttack);
  drawPlayer();
}

function loop(timestamp) {
  if (!gameState.running) return;
  const deltaTime = timestamp - gameState.lastTimestamp;
  gameState.lastTimestamp = timestamp;

  updateGame(deltaTime);
  drawGame();

  if (gameState.running) {
    requestAnimationFrame(loop);
  }
}

function endGame() {
  gameState.running = false;
  saveHighscore(gameState.score);
  openGameOverOverlay();
}

function handleCanvasPointerDown(event) {
  if (event.button !== 2) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const direction = normalize(x - player.x, y - player.y);
  gameState.target = direction;
  gameState.playerDirection = direction.x === 0 && direction.y === 0 ? gameState.playerDirection : direction;
}

function submitScore() {
  const name = playerNameInput.value.trim() || '익명';
  rankingData.push({ name, score: gameState.score });
  rankingData.sort((a, b) => b.score - a.score);
  rankingData = rankingData.slice(0, 10);
  saveRanking();
  updateRankingList();
  saveHighscore(gameState.score);
  playerNameInput.value = '';
}

function showStartOverlay() {
  resetGameState();
  openStartOverlay();
  drawGame();
}

function startGame() {
  resetGameState();
  gameState.difficulty = difficultySelect.value;
  setDifficultyClass(gameState.difficulty);
  updateDifficultyDescription();

  startOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  gameState.running = true;
  gameState.lastTimestamp = performance.now();
  gameState.elapsed = 0;
  gameState.score = 0;
  scoreValue.textContent = '0';
  highscoreValue.textContent = getHighscore();
  gameState.attacks = [];
  gameState.target = { x: 0, y: 0 };
  gameState.playerDirection = { x: 0, y: -1 };
  gameState.spawnTimer = 0;
  requestAnimationFrame(loop);
}

function initializeGame() {
  resizeCanvas();
  loadRanking();
  updateRankingList();
  highscoreValue.textContent = getHighscore();
  updateDifficultyDescription();
  showStartOverlay();
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', initializeGame);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', handleCanvasPointerDown);
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', showStartOverlay);
submitScoreButton.addEventListener('click', submitScore);
playAgainButton.addEventListener('click', startGame);
difficultySelect.addEventListener('change', updateDifficultyDescription);

canvas.addEventListener('pointerup', (event) => {
  if (event.button === 2) {
    if (gameState.target.x === 0 && gameState.target.y === 0) return;
  }
});
