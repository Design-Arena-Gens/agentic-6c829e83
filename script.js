const canvas = document.getElementById("track");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const lapCounterEl = document.getElementById("lapCounter");
const timerEl = document.getElementById("timer");
const speedEl = document.getElementById("speed");
const positionEl = document.getElementById("position");
const leaderboardEl = document.getElementById("leaderboard");

const keys = new Set();
const TOTAL_LAPS = 3;

class Track {
  constructor(canvas) {
    this.canvas = canvas;
    this.center = { x: canvas.width / 2, y: canvas.height / 2 };
    this.outer = { rx: 360, ry: 210 };
    this.inner = { rx: 188, ry: 116 };
    this.lane = { rx: 270, ry: 155 };
    this.detail = { rx: 310, ry: 185 };
    this.boostPads = [
      { angle: Math.PI * 0.08, span: 0.32 },
      { angle: Math.PI * 1.05, span: 0.28 },
      { angle: Math.PI * 1.65, span: 0.25 }
    ];
  }

  normalizeAngle(angle) {
    let a = angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a;
  }

  ellipseValue(offset, ellipse) {
    const dx = offset.x;
    const dy = offset.y;
    return (dx * dx) / (ellipse.rx * ellipse.rx) + (dy * dy) / (ellipse.ry * ellipse.ry);
  }

  angleFor(position) {
    const dx = position.x - this.center.x;
    const dy = position.y - this.center.y;
    return Math.atan2(dy / this.outer.ry, dx / this.outer.rx);
  }

  laneDistance(position, ellipse) {
    const dx = (position.x - this.center.x) / ellipse.rx;
    const dy = (position.y - this.center.y) / ellipse.ry;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clampToBounds(racer) {
    const offset = {
      x: racer.position.x - this.center.x,
      y: racer.position.y - this.center.y
    };

    const outerValue = this.ellipseValue(offset, this.outer);
    if (outerValue > 1) {
      const factor = 1 / Math.sqrt(outerValue);
      offset.x *= factor * 0.995;
      offset.y *= factor * 0.995;
      racer.position.x = this.center.x + offset.x;
      racer.position.y = this.center.y + offset.y;
      racer.velocity.x *= 0.45;
      racer.velocity.y *= 0.45;
    }

    const innerValue = this.ellipseValue(offset, this.inner);
    if (innerValue < 1) {
      const factor = 1 / Math.sqrt(innerValue);
      offset.x *= factor * 1.005;
      offset.y *= factor * 1.005;
      racer.position.x = this.center.x + offset.x;
      racer.position.y = this.center.y + offset.y;
      racer.velocity.x *= 0.35;
      racer.velocity.y *= 0.35;
    }
  }

  surfaceAt(position) {
    const offset = {
      x: position.x - this.center.x,
      y: position.y - this.center.y
    };
    const outerValue = this.ellipseValue(offset, this.outer);
    if (outerValue > 1.015) {
      return { grip: 0.25, maxSpeed: 80, boost: 0, offTrack: true };
    }

    const innerValue = this.ellipseValue(offset, this.inner);
    if (innerValue < 1) {
      return { grip: 0.3, maxSpeed: 65, boost: 0, offTrack: true };
    }

    const angle = this.normalizeAngle(this.angleFor(position));
    const laneDistance = this.laneDistance(position, this.lane);
    const detailDistance = this.laneDistance(position, this.detail);

    let grip = 0.78;
    let maxSpeed = 220;
    let boost = 0;

    if (detailDistance > 1.06 || detailDistance < 0.78) {
      grip = 0.68;
      maxSpeed = 190;
    }

    if (laneDistance > 0.88 && laneDistance < 1.12) {
      grip = 0.98;
      maxSpeed = 255;
    }

    for (const pad of this.boostPads) {
      const difference = shortestAngle(angle, pad.angle);
      if (Math.abs(difference) < pad.span / 2 && Math.abs(laneDistance - 1) < 0.09) {
        boost = 230;
        grip = 1.05;
        maxSpeed = 290;
        break;
      }
    }

    return { grip, maxSpeed, boost, offTrack: false };
  }

  drawBackground() {
    const gradient = ctx.createRadialGradient(
      this.center.x,
      this.center.y,
      80,
      this.center.x,
      this.center.y,
      520
    );
    gradient.addColorStop(0, "#031028");
    gradient.addColorStop(1, "#01030b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTrack() {
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.beginPath();
    ctx.ellipse(0, 0, this.outer.rx, this.outer.ry, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, this.inner.rx, this.inner.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2a4868";
    ctx.fill("evenodd");

    ctx.beginPath();
    ctx.ellipse(0, 0, this.detail.rx, this.detail.ry, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, this.inner.rx + 16, this.inner.ry + 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#20344d";
    ctx.fill("evenodd");

    ctx.beginPath();
    ctx.ellipse(0, 0, this.lane.rx + 12, this.lane.ry + 10, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, this.lane.rx - 14, this.lane.ry - 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90, 180, 255, 0.08)";
    ctx.fill("evenodd");

    ctx.restore();
  }

  drawBoostPads() {
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.lineCap = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(255, 239, 150, 0.78)";

    for (const pad of this.boostPads) {
      const start = pad.angle - pad.span / 2;
      const end = pad.angle + pad.span / 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.lane.rx, this.lane.ry, 0, start, end);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRacingLine() {
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.setLineDash([12, 18]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.lane.rx, this.lane.ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawStartLine() {
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.rotate(Math.PI / 2);
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(0, this.inner.ry + 12);
    ctx.lineTo(0, this.outer.ry - 12);
    ctx.stroke();

    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(-6, this.inner.ry + 12);
    ctx.lineTo(-6, this.outer.ry - 12);
    ctx.stroke();
    ctx.restore();
  }

  render() {
    this.drawBackground();
    this.drawTrack();
    this.drawBoostPads();
    this.drawRacingLine();
    this.drawStartLine();
    this.drawCrowd();
    this.drawLighting();
  }

  drawCrowd() {
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    const layers = 3;
    for (let i = 0; i < layers; i += 1) {
      const rx = this.outer.rx + 40 + i * 18;
      const ry = this.outer.ry + 30 + i * 18;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 - i * 0.02})`;
      ctx.lineWidth = 12 - i * 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLighting() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lights = [
      { x: this.center.x - this.outer.rx - 40, y: this.center.y - this.outer.ry - 60 },
      { x: this.center.x + this.outer.rx + 40, y: this.center.y - this.outer.ry - 60 },
      { x: this.center.x - this.outer.rx - 40, y: this.center.y + this.outer.ry + 60 },
      { x: this.center.x + this.outer.rx + 40, y: this.center.y + this.outer.ry + 60 }
    ];
    for (const light of lights) {
      const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 180);
      grad.addColorStop(0, "rgba(80, 140, 255, 0.6)");
      grad.addColorStop(1, "rgba(80, 140, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(light.x - 180, light.y - 180, 360, 360);
    }
    ctx.restore();
  }
}

class Racer {
  constructor({ name, color, isPlayer, startOffset }) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.velocity = { x: 0, y: 0 };
    this.heading = -Math.PI / 2;
    this.position = { x: 0, y: 0 };
    this.startOffset = startOffset;
    this.completedLaps = 0;
    this.lapHistory = [];
    this.lastAngle = 0;
    this.distanceAccumulator = 0;
    this.finished = false;
    this.finishTime = null;
  }

  placeOnTrack(track) {
    const angle = Math.PI * 1.5 + this.startOffset;
    this.heading = -Math.PI / 2;
    this.position.x = track.center.x + Math.cos(angle) * (track.lane.rx + this.startOffset * 12);
    this.position.y = track.center.y + Math.sin(angle) * (track.lane.ry + this.startOffset * 12);
    this.lastAngle = track.normalizeAngle(track.angleFor(this.position));
  }

  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.y);
  }

  update(dt, track, inputState, elapsed) {
    if (this.finished) return;
    const surface = track.surfaceAt(this.position);
    if (this.isPlayer) {
      this.controlPlayer(dt, surface, inputState);
    } else {
      this.controlAI(dt, surface, track, elapsed);
    }
    this.applyPhysics(dt, surface);
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    track.clampToBounds(this);
    this.updateLapProgress(track, surface, elapsed);
  }

  controlPlayer(dt, surface, inputState) {
    const forwardInput = inputState.forward ? 1 : 0;
    const brakeInput = inputState.backward ? 1 : 0;
    const steer = inputState.right - inputState.left;

    const forward = directionFromAngle(this.heading);
    const thrust = forwardInput * 230 - brakeInput * 160;
    this.velocity.x += forward.x * thrust * dt;
    this.velocity.y += forward.y * thrust * dt;

    this.heading += steer * (1.8 + Math.min(this.speed, 260) / 160) * dt;

    if (inputState.drift) {
      const lateral = { x: -forward.y, y: forward.x };
      this.velocity.x += lateral.x * 45 * dt;
      this.velocity.y += lateral.y * 45 * dt;
    }

    if (surface.boost > 0) {
      this.velocity.x += forward.x * surface.boost * dt;
      this.velocity.y += forward.y * surface.boost * dt;
    }
  }

  controlAI(dt, surface, track, elapsed) {
    const forward = directionFromAngle(this.heading);
    const angle = track.angleFor(this.position);
    const targetAngle = track.normalizeAngle(angle + 0.24);
    const currentAngle = track.normalizeAngle(angle);
    let diff = shortestAngle(targetAngle, currentAngle);
    diff += Math.sin(elapsed * 0.8 + this.startOffset * 5) * 0.02;
    this.heading += diff * 1.9 * dt;

    const thrustBase = 210 + Math.sin(elapsed * 1.2 + this.startOffset * 9) * 18;
    this.velocity.x += forward.x * thrustBase * dt;
    this.velocity.y += forward.y * thrustBase * dt;

    if (surface.boost > 0) {
      this.velocity.x += forward.x * surface.boost * dt * 0.65;
      this.velocity.y += forward.y * surface.boost * dt * 0.65;
    }

    if (surface.offTrack) {
      this.heading += diff * 2.5 * dt;
    }
  }

  applyPhysics(dt, surface) {
    const dragBase = 0.68;
    const gripFactor = clamp(surface.grip, 0.2, 1.25);
    this.velocity.x *= 1 - dragBase * dt;
    this.velocity.y *= 1 - dragBase * dt;
    this.velocity.x *= 1 - (1 - gripFactor) * 1.4 * dt;
    this.velocity.y *= 1 - (1 - gripFactor) * 1.4 * dt;

    const maxSpeed = surface.maxSpeed + 50;
    const magnitude = this.speed;
    if (magnitude > maxSpeed) {
      const scale = maxSpeed / magnitude;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }
  }

  updateLapProgress(track, surface, elapsed) {
    const angle = track.normalizeAngle(track.angleFor(this.position));
    if (this.speed > 60) {
      if (this.lastAngle > Math.PI * 1.5 && angle < Math.PI * 0.5) {
        this.completedLaps += 1;
        this.lapHistory.push(elapsed);
        this.distanceAccumulator = 0;
        if (this.completedLaps >= TOTAL_LAPS) {
          this.finished = true;
          this.finishTime = elapsed;
        }
      }
    }
    this.lastAngle = angle;

    if (!surface.offTrack) {
      this.distanceAccumulator += this.speed;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.heading);
    ctx.beginPath();
    ctx.fillStyle = this.isPlayer ? this.color : `${this.color}`;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(6, 14, -16, 6);
    ctx.quadraticCurveTo(-12, 0, -16, -6);
    ctx.quadraticCurveTo(6, -14, 16, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(3, -6, 3, 0, Math.PI * 2);
    ctx.arc(3, 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  currentLapProgress(track) {
    const angle = track.normalizeAngle(track.angleFor(this.position));
    return angle / (Math.PI * 2);
  }
}

class Leaderboard {
  constructor(limit = 6) {
    this.limit = limit;
    this.entries = this.load();
    this.render();
  }

  load() {
    try {
      const stored = localStorage.getItem("bink-race-leaderboard");
      if (!stored) return [];
      return JSON.parse(stored).slice(0, this.limit);
    } catch (err) {
      console.warn("Unable to load leaderboard", err);
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem("bink-race-leaderboard", JSON.stringify(this.entries.slice(0, this.limit)));
    } catch (err) {
      console.warn("Unable to save leaderboard", err);
    }
  }

  push(entry) {
    this.entries.push(entry);
    this.entries.sort((a, b) => a.time - b.time);
    this.entries = this.entries.slice(0, this.limit);
    this.save();
    this.render();
  }

  render() {
    leaderboardEl.innerHTML = "";
    if (!this.entries.length) {
      const li = document.createElement("li");
      li.textContent = "Finish a race to post your time!";
      leaderboardEl.appendChild(li);
      return;
    }
    this.entries.forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${formatTime(entry.time)}</strong> – ${entry.name}`;
      leaderboardEl.appendChild(li);
    });
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.track = new Track(canvas);
    this.leaderboard = new Leaderboard();
    this.state = "idle";
    this.lastTimestamp = 0;
    this.elapsed = 0;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.goTimer = 0;
    this.player = null;
    this.racers = [];
    this.positionIndex = 1;
    this.overlayMessage = "";
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupRace() {
    const player = new Racer({
      name: "You",
      color: "#f72585",
      isPlayer: true,
      startOffset: 0
    });
    const rivalOne = new Racer({
      name: "Bink Nova",
      color: "#4cc9f0",
      isPlayer: false,
      startOffset: 0.17
    });
    const rivalTwo = new Racer({
      name: "Solar Bink",
      color: "#fee440",
      isPlayer: false,
      startOffset: -0.18
    });
    const rivalThree = new Racer({
      name: "Midnight Bink",
      color: "#48cae4",
      isPlayer: false,
      startOffset: 0.33
    });

    this.racers = [player, rivalOne, rivalTwo, rivalThree];
    this.player = player;

    this.racers.forEach((racer) => {
      racer.placeOnTrack(this.track);
      racer.velocity.x = 0;
      racer.velocity.y = 0;
      racer.completedLaps = 0;
      racer.lapHistory = [];
      racer.finished = false;
      racer.finishTime = null;
      racer.lastAngle = this.track.normalizeAngle(this.track.angleFor(racer.position));
    });
  }

  startRace() {
    this.setupRace();
    this.elapsed = 0;
    this.state = "countdown";
    this.countdown = 3;
    this.countdownTimer = 0;
    this.goTimer = 0;
    this.overlayMessage = "";
    startButton.disabled = true;
    startButton.textContent = "Racing...";
  }

  update(dt) {
    if (this.state === "countdown") {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 1) {
        this.countdown -= 1;
        this.countdownTimer = 0;
        if (this.countdown <= 0) {
          this.state = "running";
          this.goTimer = 0.65;
        }
      }
    } else if (this.state === "running") {
      this.elapsed += dt;
      if (this.goTimer > 0) {
        this.goTimer = Math.max(0, this.goTimer - dt);
      }
      const inputState = readInputState();
      this.racers.forEach((racer) => racer.update(dt, this.track, inputState, this.elapsed));
      this.resolvePosition();
      this.checkFinish();
    } else if (this.state === "finished") {
      // hold final overlay
    }
  }

  resolvePosition() {
    const standings = this.racers
      .map((racer) => ({
        racer,
        progress: racer.completedLaps + racer.currentLapProgress(this.track)
      }))
      .sort((a, b) => b.progress - a.progress);
    this.positionIndex = standings.findIndex((entry) => entry.racer === this.player) + 1;
  }

  checkFinish() {
    if (this.player.finished && this.state !== "finished") {
      this.state = "finished";
      this.overlayMessage = `Finished in P${this.positionIndex}`;
      this.leaderboard.push({
        name: `P${this.positionIndex} • ${new Date().toLocaleDateString()}`,
        time: this.player.finishTime
      });
      setTimeout(() => {
        startButton.disabled = false;
        startButton.textContent = "Race Again";
      }, 400);
    }
  }

  drawOverlay() {
    if (this.state === "countdown") {
      ctx.save();
      ctx.fillStyle = "rgba(4, 9, 16, 0.75)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 64px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText(this.countdown, this.canvas.width / 2, this.canvas.height / 2);
      ctx.restore();
    } else if (this.state === "finished") {
      ctx.save();
      ctx.fillStyle = "rgba(4, 9, 16, 0.8)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#f72585";
      ctx.font = "bold 60px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText("Race Complete!", this.canvas.width / 2, this.canvas.height / 2 - 20);
      ctx.fillStyle = "#f1faee";
      ctx.font = "bold 32px 'Segoe UI'";
      ctx.fillText(this.overlayMessage, this.canvas.width / 2, this.canvas.height / 2 + 28);
      ctx.fillText(`Time: ${formatTime(this.player.finishTime)}`, this.canvas.width / 2, this.canvas.height / 2 + 70);
      ctx.restore();
    } else if (this.goTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(4, 9, 16, 0.55)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 72px 'Segoe UI'";
      ctx.textAlign = "center";
      ctx.fillText("GO!", this.canvas.width / 2, this.canvas.height / 2);
      ctx.restore();
    }
  }

  updateHUD() {
    if (!this.player) {
      lapCounterEl.textContent = `0 / ${TOTAL_LAPS}`;
      timerEl.textContent = formatTime(0);
      speedEl.textContent = "0";
      positionEl.textContent = "--";
      return;
    }
    const currentLap = this.player.finished ? TOTAL_LAPS : Math.min(this.player.completedLaps + 1, TOTAL_LAPS);
    lapCounterEl.textContent = `${currentLap} / ${TOTAL_LAPS}`;
    const timerValue = this.state === "running" || this.state === "finished" ? this.elapsed : 0;
    timerEl.textContent = formatTime(timerValue);
    speedEl.textContent = `${Math.round(this.player.speed)}`;
    positionEl.textContent = this.state === "idle" ? "--" : `P${this.positionIndex}`;
  }

  render() {
    this.track.render();
    this.racers.forEach((racer) => racer.draw(ctx));
    this.drawOverlay();
    this.updateHUD();
  }

  loop(timestamp) {
    const dt = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestamp;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

function readInputState() {
  return {
    forward: keys.has("ArrowUp") || keys.has("KeyW"),
    backward: keys.has("ArrowDown") || keys.has("KeyS"),
    left: keys.has("ArrowLeft") || keys.has("KeyA"),
    right: keys.has("ArrowRight") || keys.has("KeyD"),
    drift: keys.has("Space")
  };
}

function formatTime(seconds) {
  const totalMs = Math.floor(seconds * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const remainingMs = totalMs % 60000;
  const secs = Math.floor(remainingMs / 1000);
  const tenths = Math.floor((remainingMs % 1000) / 100);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${tenths}`;
}

function directionFromAngle(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shortestAngle(a, b) {
  let diff = a - b;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

const game = new Game(canvas);

startButton.addEventListener("click", () => {
  game.startRace();
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});
