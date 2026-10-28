const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

function getCanvasSize() {
  return {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  };
}

const headImage = new Image();
headImage.src = "assets/shifu.png";

const openMouthImage = new Image();
openMouthImage.src = "assets/shifu-mouth-open.png";

function waitForImage(image) {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`Failed to load ${image.src}`));
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${image.src}`)),
      { once: true },
    );
  });
}

Promise.all([waitForImage(headImage), waitForImage(openMouthImage)])
  .then(() => {
    playButton.disabled = false;
    playButton.textContent = "Play";
  })
  .catch((error) => {
    console.error(error);
    playButton.textContent = "Image failed to load";
  });

const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

const scoreDisplay = document.querySelector("#score");

const timerDisplay = document.querySelector("#timer");
const gameOverScreen = document.querySelector("#gameOver");
const finalScoreDisplay = document.querySelector("#finalScore");
const restartButton = document.querySelector("#restartButton");

const pauseButton = document.querySelector("#pauseButton");
const restartNowButton = document.querySelector("#restartNowButton");

const startScreen = document.querySelector("#startScreen");
const playButton = document.querySelector("#playButton");

const roundDuration = 30;

let timeRemaining = roundDuration;
let gameOver = false;
let paused = true;

let expressionTime = 0;
const openMouthDuration = 0.35;

function setupMovementButton(button, direction) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    movement[direction] = true;
    button.setPointerCapture(event.pointerId);
  });

  function stopMoving() {
    movement[direction] = false;
  }

  button.addEventListener("pointerup", stopMoving);
  button.addEventListener("pointercancel", stopMoving);
  button.addEventListener("lostpointercapture", stopMoving);
}

setupMovementButton(leftButton, "left");
setupMovementButton(rightButton, "right");

const player = {
  x: 0,
  y: 0,
  headRadius: 50,
  bodyLength: 65,
};

const movement = {
  left: false,
  right: false,
};

const playerSpeed = 300; // pixels per second

const candies = [];

const candySettings = {
  radius: 12,
  minSpeed: 120,
  maxSpeed: 220,
  spawnInterval: 0.8,
};

function resizeCanvas() {
  const { width, height } = getCanvasSize();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  // Draw using CSS-pixel coordinates, even on high-DPI screens.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.x = width / 2;
  player.y = height * (width > height && height < 500 ? 0.88 : 0.68);

  drawGame();
}

function drawPlayer() {
  const r = player.headRadius;
  const headX = player.x;
  const headY = player.y - player.bodyLength - 2 * r;

  // Stickman body.
  ctx.strokeStyle = "#27364b";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(player.x, headY + 2 * r - 2);
  ctx.lineTo(player.x, player.y);
  ctx.moveTo(player.x, player.y - 45);
  ctx.lineTo(player.x - 22, player.y - 12);
  ctx.moveTo(player.x, player.y - 45);
  ctx.lineTo(player.x + 22, player.y - 12);
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x - 18, player.y + 28);
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + 18, player.y + 28);
  ctx.stroke();

  // Circular head image.
  const currentHeadImage =
    expressionTime > 0 &&
    openMouthImage.complete &&
    openMouthImage.naturalWidth > 0
      ? openMouthImage
      : headImage;
  if (currentHeadImage.complete && currentHeadImage.naturalWidth > 0) {
    ctx.save();

    ctx.beginPath();
    ctx.arc(headX, headY + r, r, 0, Math.PI * 2);
    ctx.clip();

    // Center-crop the image to a square before drawing.
    const size = Math.min(headImage.naturalWidth, headImage.naturalHeight);

    const sx = (currentHeadImage.naturalWidth - size) / 2;
    const sy = (currentHeadImage.naturalHeight - size) / 2;

    ctx.drawImage(
      currentHeadImage,
      sx,
      sy,
      size,
      size,
      headX - r,
      headY,
      2 * r,
      2 * r,
    );

    ctx.restore();
  } else {
    // Temporary placeholder while the image loads.
    ctx.fillStyle = "#f2c9a5";
    ctx.beginPath();
    ctx.arc(headX, headY + r, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spawnCandy() {
  const { width } = getCanvasSize();

  const radius = candySettings.radius;

  candies.push({
    x: radius + Math.random() * (width - 2 * radius),
    y: -radius,
    radius: radius,
    speed:
      candySettings.minSpeed +
      Math.random() * (candySettings.maxSpeed - candySettings.minSpeed),
  });
}

function drawCandies() {
  for (const candy of candies) {
    ctx.fillStyle = "#ff4f81";

    ctx.beginPath();
    ctx.arc(candy.x, candy.y, candy.radius, 0, Math.PI * 2);
    ctx.fill();

    // Small highlight to make the candy look shiny.
    ctx.fillStyle = "#ffffff";

    ctx.beginPath();
    ctx.arc(candy.x - 3, candy.y - 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateCandies(deltaTime) {
  for (const candy of candies) {
    candy.y += candy.speed * deltaTime;
  }

  // Keep only candies that haven't passed the bottom.
  const { height } = getCanvasSize();

  for (let i = candies.length - 1; i >= 0; i--) {
    if (candies[i].y - candies[i].radius > height) {
      candies.splice(i, 1);
    }
  }
}

function drawGame() {
  const { width, height } = getCanvasSize();

  ctx.clearRect(0, 0, width, height);

  // Temporary sky background.
  ctx.fillStyle = "#c9efff";
  ctx.fillRect(0, 0, width, height);

  drawPlayer();
  drawCandies();
}

function updateGame(deltaTime) {
  if (gameOver || paused) return;
  expressionTime = Math.max(0, expressionTime - deltaTime);
  timeRemaining -= deltaTime;

  if (timeRemaining <= 0) {
    timeRemaining = 0;
    timerDisplay.textContent = "Time: 0";
    endGame();
    return;
  }

  timerDisplay.textContent = `Time: ${Math.ceil(timeRemaining)}`;

  if (movement.left) {
    player.x -= playerSpeed * deltaTime;
  }

  if (movement.right) {
    player.x += playerSpeed * deltaTime;
  }

  const { width } = getCanvasSize();
  const r = player.headRadius;

  player.x = Math.max(r, Math.min(width - r, player.x));

  // Spawn candies at regular intervals.
  spawnTimer += deltaTime;

  if (spawnTimer >= candySettings.spawnInterval) {
    spawnCandy();
    spawnTimer -= candySettings.spawnInterval;
  }

  updateCandies(deltaTime);
  checkCandyCatches();
}

function getMouthPosition() {
  return {
    x: player.x,
    y: player.y - player.bodyLength - player.headRadius * 0.35,
  };
}

function checkCandyCatches() {
  const mouth = getMouthPosition();

  for (let i = candies.length - 1; i >= 0; i--) {
    const candy = candies[i];

    const dx = candy.x - mouth.x;
    const dy = candy.y - mouth.y;

    const distanceSquared = dx * dx + dy * dy;
    const catchRadius = candy.radius + 20;

    if (distanceSquared <= catchRadius * catchRadius) {
      candies.splice(i, 1);
      score++;
      scoreDisplay.textContent = `Candies: ${score}`;
      expressionTime = openMouthDuration;
    }
  }
}

function endGame() {
  gameOver = true;

  movement.left = false;
  movement.right = false;

  finalScoreDisplay.textContent = `You caught ${score} candies!`;

  gameOverScreen.hidden = false;

  paused = false;
  pauseButton.textContent = "Pause";
  pauseButton.disabled = true;
}

function restartGame() {
  if (!startScreen.hidden) return;
  score = 0;
  timeRemaining = roundDuration;
  gameOver = false;
  spawnTimer = 0;

  candies.length = 0;

  const { width, height } = getCanvasSize();

  player.x = width / 2;
  player.y = height * (width > height && height < 500 ? 0.88 : 0.68);
  scoreDisplay.textContent = "Candies: 0";
  timerDisplay.textContent = `Time: ${roundDuration}`;

  movement.left = false;
  movement.right = false;

  gameOverScreen.hidden = true;

  paused = false;
  pauseButton.textContent = "Pause";
  pauseButton.disabled = false;
}

function togglePause() {
  if (gameOver) return;

  paused = !paused;

  movement.left = false;
  movement.right = false;

  pauseButton.textContent = paused ? "Resume" : "Pause";
}

pauseButton.addEventListener("click", togglePause);

restartButton.addEventListener("click", restartGame);

restartNowButton.addEventListener("click", restartGame);

playButton.addEventListener("click", () => {
  if (playButton.disabled) return;

  startScreen.hidden = true;
  paused = false;
  pauseButton.textContent = "Pause";
});

let previousTime = null;
let spawnTimer = 0;
let score = 0;

function animate(currentTime) {
  let deltaTime = 0;

  if (previousTime !== null) {
    deltaTime = (currentTime - previousTime) / 1000;

    // Avoid a large jump after a tab is suspended.
    deltaTime = Math.min(deltaTime, 0.05);
  }

  previousTime = currentTime;

  updateGame(deltaTime);
  drawGame();

  requestAnimationFrame(animate);
}

headImage.addEventListener("load", drawGame);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
requestAnimationFrame(animate);
