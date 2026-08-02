const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TOTAL_STAGES = 100;
const BASE_ENEMY_BULLET_LIMIT = 160;

const ui = {
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  weapon: document.getElementById("weaponValue"),
  shield: document.getElementById("shieldValue"),
  stageNumber: document.getElementById("stageNumberValue"),
  threat: document.getElementById("threatValue"),
  stageValue: document.getElementById("stageValue"),
  stageBar: document.getElementById("stageBar"),
  statusLine: document.getElementById("statusLine"),
  startButton: document.getElementById("startButton"),
  pauseButton: document.getElementById("pauseButton"),
  restartButton: document.getElementById("restartButton"),
  musicToggle: document.getElementById("musicToggle"),
  sfxToggle: document.getElementById("sfxToggle"),
  rankingStatus: document.getElementById("rankingStatus"),
  leaderboardList: document.getElementById("leaderboardList"),
  refreshRankingButton: document.getElementById("refreshRankingButton"),
  scoreForm: document.getElementById("scoreForm"),
  playerNameInput: document.getElementById("playerNameInput"),
  playerPinInput: document.getElementById("playerPinInput"),
  submitScoreValue: document.getElementById("submitScoreValue"),
  submitScoreButton: document.getElementById("submitScoreButton")
};

const ASSET_PATHS = {
  player: "assets/player-ship.png",
  enemy: "assets/enemy-drone.png",
  boss: "assets/boss-dreadnought.png"
};

const AUDIO_PATHS = {
  bgm: "assets/audio/bgm-neon-strike.wav",
  shot: "assets/audio/sfx-shot.wav",
  laser: "assets/audio/sfx-laser.wav",
  explosion: "assets/audio/sfx-explosion.wav",
  hit: "assets/audio/sfx-hit.wav",
  pickup: "assets/audio/sfx-pickup.wav",
  alert: "assets/audio/sfx-alert.wav",
  beam: "assets/audio/sfx-beam.wav",
  victory: "assets/audio/sfx-victory.wav",
  failure: "assets/audio/sfx-failure.wav"
};

const rankingConfig = {
  url: String(window.ASTRA_CONFIG?.supabaseUrl ?? "").replace(/\/+$/, ""),
  anonKey: String(window.ASTRA_CONFIG?.supabaseAnonKey ?? "")
};

const BOSS_PREFIXES = [
  "Abyss",
  "Crimson",
  "Phantom",
  "Nebula",
  "Iron",
  "Vanta",
  "Solar",
  "Tempest",
  "Titan",
  "Omega"
];

const BOSS_SUFFIXES = [
  "Harrier",
  "Basilisk",
  "Leviathan",
  "Cerberus",
  "Monarch",
  "Hydra",
  "Revenant",
  "Colossus",
  "Singularity",
  "Overlord"
];

const MOVEMENT_NAMES = [
  "Sine Glide",
  "Corkscrew Dive",
  "Warp Step",
  "Lancer Dash",
  "Fortress Hover",
  "Serpent Coil",
  "Crusher Charge",
  "Mirror Hunter",
  "Orbital Wheel",
  "Storm Drift"
];

const ATTACK_NAMES = [
  "Tri Cannon",
  "Fan Barrage",
  "Sweep Beam",
  "Meteor Rain",
  "Spiral Lance",
  "Sniper Lock",
  "Pulse Wall",
  "Mine Bloom",
  "Crossfire Grid",
  "Nova Burst"
];

const keys = new Set();
const pointer = {
  active: false,
  x: canvas.width * 0.25,
  y: canvas.height * 0.5
};

const pickupOrder = ["speed", "wingman", "laser", "shield"];

const state = {
  mode: "ready",
  frame: 0,
  score: 0,
  totalKills: 0,
  enemySpawnTimer: 0,
  nextPickupIndex: 0,
  images: {},
  stars: [],
  bullets: [],
  enemyBullets: [],
  enemies: [],
  pickups: [],
  effects: [],
  boss: null,
  cameraShake: 0,
  player: null,
  messageTimer: 0,
  stageNumber: 1,
  stageScore: 0,
  stageTarget: 0,
  stageWaveTimer: 0,
  stageMinFrames: 0,
  stageTransition: 0,
  stageIntroTimer: 0,
  nextStage: 2,
  stageState: "wave",
  pendingBossSpawn: false,
  previewBossName: "Boss Preview",
  previewThreatLabel: "Threat Scan",
  finalVictory: false,
  scoreSubmissionReady: false,
  submittedRunScore: 0
};

const audioState = {
  musicEnabled: true,
  sfxEnabled: true,
  unlocked: false,
  bgm: null,
  active: new Set()
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function createImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadAssets() {
  const entries = await Promise.all(
    Object.entries(ASSET_PATHS).map(async ([key, path]) => [key, await createImage(path)])
  );
  state.images = Object.fromEntries(entries);
}

function setupAudio() {
  audioState.bgm = new Audio(AUDIO_PATHS.bgm);
  audioState.bgm.loop = true;
  audioState.bgm.preload = "auto";
  audioState.bgm.volume = 0.42;
  syncAudioButtons();
}

function unlockAudio() {
  if (audioState.unlocked) {
    return;
  }
  audioState.unlocked = true;
  if (audioState.bgm) {
    audioState.bgm.load();
  }
}

function syncAudioButtons() {
  ui.musicToggle.textContent = audioState.musicEnabled ? "Music On" : "Music Off";
  ui.sfxToggle.textContent = audioState.sfxEnabled ? "SFX On" : "SFX Off";
  ui.musicToggle.classList.toggle("is-on", audioState.musicEnabled);
  ui.musicToggle.classList.toggle("is-off", !audioState.musicEnabled);
  ui.sfxToggle.classList.toggle("is-on", audioState.sfxEnabled);
  ui.sfxToggle.classList.toggle("is-off", !audioState.sfxEnabled);
}

function playBgm(reset = false) {
  if (!audioState.musicEnabled || !audioState.bgm) {
    return;
  }
  if (reset) {
    audioState.bgm.currentTime = 0;
  }
  const promise = audioState.bgm.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {});
  }
}

function pauseBgm(reset = false) {
  if (!audioState.bgm) {
    return;
  }
  audioState.bgm.pause();
  if (reset) {
    audioState.bgm.currentTime = 0;
  }
}

function playSfx(name, options = {}) {
  if (!audioState.sfxEnabled) {
    return;
  }

  const src = AUDIO_PATHS[name];
  if (!src) {
    return;
  }

  const sound = new Audio(src);
  sound.volume = clamp(options.volume ?? 0.65, 0, 1);
  sound.playbackRate = options.rate ?? 1;
  sound.preservesPitch = false;
  sound.preload = "auto";

  audioState.active.add(sound);
  const cleanup = () => {
    audioState.active.delete(sound);
  };

  sound.addEventListener("ended", cleanup, { once: true });
  sound.addEventListener("error", cleanup, { once: true });

  const promise = sound.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch(cleanup);
  }
}

function isRankingConfigured() {
  return rankingConfig.url.startsWith("https://") && rankingConfig.anonKey.length > 20;
}

function getRankingHeaders() {
  const headers = {
    apikey: rankingConfig.anonKey,
    "Content-Type": "application/json"
  };

  // Legacy anon keys are JWTs; new sb_publishable keys must use apikey only.
  if (rankingConfig.anonKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${rankingConfig.anonKey}`;
  }

  return headers;
}

function setRankingStatus(message, type = "") {
  ui.rankingStatus.textContent = message;
  ui.rankingStatus.classList.toggle("is-error", type === "error");
  ui.rankingStatus.classList.toggle("is-success", type === "success");
}

function renderLeaderboard(rows) {
  ui.leaderboardList.replaceChildren();

  if (!rows.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "ranking-empty";
    emptyItem.textContent = "まだスコアがありません";
    ui.leaderboardList.append(emptyItem);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const score = document.createElement("strong");

    name.className = "ranking-name";
    name.textContent = row.display_name;
    score.className = "ranking-score";
    score.textContent = Number(row.score).toLocaleString("ja-JP");

    item.append(name, score);
    ui.leaderboardList.append(item);
  });
}

async function loadLeaderboard() {
  if (!isRankingConfigured()) {
    setRankingStatus("config.js にSupabase接続情報を設定してください。", "error");
    ui.refreshRankingButton.disabled = true;
    return;
  }

  ui.refreshRankingButton.disabled = true;
  setRankingStatus("ランキングを読み込み中...");

  try {
    const response = await fetch(`${rankingConfig.url}/rest/v1/rpc/get_leaderboard`, {
      method: "POST",
      headers: getRankingHeaders(),
      body: JSON.stringify({ p_limit: 20 })
    });

    if (!response.ok) {
      throw new Error("RANKING_LOAD_FAILED");
    }

    const rows = await response.json();
    renderLeaderboard(Array.isArray(rows) ? rows : []);
    setRankingStatus("上位20件を表示しています。");
  } catch {
    setRankingStatus("ランキングを読み込めませんでした。接続設定を確認してください。", "error");
  } finally {
    ui.refreshRankingButton.disabled = false;
  }
}

function resetScoreSubmission() {
  state.scoreSubmissionReady = false;
  state.submittedRunScore = 0;
  ui.submitScoreValue.textContent = "0";
  ui.submitScoreButton.disabled = true;
  ui.playerPinInput.value = "";
}

function prepareScoreSubmission() {
  state.submittedRunScore = Math.max(0, Math.floor(state.score));
  state.scoreSubmissionReady = state.submittedRunScore > 0;
  ui.submitScoreValue.textContent = state.submittedRunScore.toLocaleString("ja-JP");
  ui.submitScoreButton.disabled = !state.scoreSubmissionReady || !isRankingConfigured();

  if (!isRankingConfigured()) {
    setRankingStatus("config.js にSupabase接続情報を設定してください。", "error");
    return;
  }

  setRankingStatus(
    state.scoreSubmissionReady
      ? "名前と登録時の4桁PINを入力してください。"
      : "登録できるスコアがありません。"
  );
}

function getSubmitErrorMessage(errorCode) {
  if (errorCode.includes("PIN_MISMATCH")) {
    return "PINが一致しないため、この名前のスコアは更新できません。";
  }
  if (errorCode.includes("INVALID_PIN")) {
    return "PINは半角数字4桁で入力してください。";
  }
  if (errorCode.includes("INVALID_NAME")) {
    return "名前は1文字以上20文字以内で入力してください。";
  }
  if (errorCode.includes("INVALID_SCORE")) {
    return "登録できないスコアです。";
  }
  return "スコア登録に失敗しました。接続設定を確認してください。";
}

async function submitScore(event) {
  event.preventDefault();

  if (!state.scoreSubmissionReady || !isRankingConfigured()) {
    setRankingStatus("ゲーム終了後にスコアを登録できます。", "error");
    return;
  }

  const name = ui.playerNameInput.value.trim();
  const pin = ui.playerPinInput.value.trim();

  if (!name || name.length > 20) {
    setRankingStatus("名前は1文字以上20文字以内で入力してください。", "error");
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    setRankingStatus("PINは半角数字4桁で入力してください。", "error");
    return;
  }

  ui.submitScoreButton.disabled = true;
  setRankingStatus("スコアを登録中...");

  try {
    const response = await fetch(`${rankingConfig.url}/rest/v1/rpc/submit_high_score`, {
      method: "POST",
      headers: getRankingHeaders(),
      body: JSON.stringify({
        p_name: name,
        p_score: state.submittedRunScore,
        p_pin: pin
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(String(result?.message ?? "SUBMIT_FAILED"));
    }

    try {
      localStorage.setItem("astraPlayerName", name);
    } catch {
      // Local storage is optional; the PIN is never stored in the browser.
    }

    ui.playerPinInput.value = "";

    let completionMessage;
    let completionType = "";

    if (result.status === "not_improved") {
      completionMessage = `現在の最高得点 ${Number(result.score).toLocaleString("ja-JP")} を超えていないため更新しませんでした。`;
    } else {
      state.scoreSubmissionReady = false;
      completionMessage = result.status === "created"
        ? "名前と最高得点を登録しました。"
        : "最高得点を更新しました。";
      completionType = "success";
    }

    await loadLeaderboard();
    setRankingStatus(completionMessage, completionType);
  } catch (error) {
    setRankingStatus(getSubmitErrorMessage(String(error?.message ?? error)), "error");
  } finally {
    ui.submitScoreButton.disabled = !state.scoreSubmissionReady || !isRankingConfigured();
  }
}

function createStars() {
  state.stars = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 2.6 + 0.4,
    speed: Math.random() * 5 + 1,
    layer: Math.random() * 0.9 + 0.3
  }));
}

function resetPlayer() {
  state.player = {
    x: 180,
    y: canvas.height / 2,
    width: 120,
    height: 60,
    lives: 4,
    speedLevel: 0,
    wingmen: 0,
    laserLevel: 0,
    shield: 0,
    cooldown: 0,
    invulnerability: 0,
    hitFlash: 0
  };
}

function setStatus(message, hold = 240) {
  ui.statusLine.textContent = message;
  state.messageTimer = hold;
}

function getStageDifficulty(stageNumber) {
  return 1 + (stageNumber - 1) * 0.09;
}

function getStageTarget(stageNumber) {
  return Math.round(1800 + stageNumber * 70 + Math.pow(stageNumber, 1.28) * 8);
}

function getStageMinFrames(stageNumber) {
  const minimumSeconds = 30 + Math.min(30, (stageNumber - 1) * 0.3);
  return Math.round(minimumSeconds * 60);
}

function getEnemyCap(stageNumber) {
  return Math.min(26, 6 + Math.floor(stageNumber / 5));
}

function getEnemyWaveSize(stageNumber) {
  const stageOffset = Math.max(0, stageNumber - 1);
  const guaranteed = 1 + Math.floor(stageOffset / 28);
  const extraChance = (stageOffset % 28) / 28;
  return Math.min(5, guaranteed + (Math.random() < extraChance ? 1 : 0));
}

function getEnemyBulletLimit(stageNumber) {
  return BASE_ENEMY_BULLET_LIMIT + stageNumber * 3;
}

function isStageWaveComplete() {
  return state.stageScore >= state.stageTarget && state.stageWaveTimer >= state.stageMinFrames;
}

function getBossProfile(stageNumber) {
  const movementIndex = (stageNumber - 1) % 10;
  const attackIndex = Math.floor((stageNumber - 1) / 10) % 10;
  const hue = (stageNumber * 31) % 360;
  const visualIndex = stageNumber - 1;
  return {
    name: `${BOSS_PREFIXES[movementIndex]} ${BOSS_SUFFIXES[attackIndex]}`,
    movementIndex,
    attackIndex,
    hue,
    visualIndex,
    hullIndex: visualIndex % 10,
    wingIndex: Math.floor(visualIndex / 10) % 10,
    coreIndex: (visualIndex * 3 + attackIndex) % 10,
    podIndex: (visualIndex * 7 + movementIndex) % 10,
    armorIndex: (visualIndex * 11 + stageNumber) % 10,
    threatLabel: stageNumber >= 20
      ? `${MOVEMENT_NAMES[movementIndex]} / ${ATTACK_NAMES[attackIndex]} + Laser Matrix Lv.${1 + Math.floor((stageNumber - 20) / 10)}`
      : `${MOVEMENT_NAMES[movementIndex]} / ${ATTACK_NAMES[attackIndex]}`
  };
}

function clearBattlefield() {
  state.bullets = [];
  state.enemyBullets = [];
  state.enemies = [];
  state.pickups = [];
}

function applyStageReward(stageNumber) {
  state.player.shield = Math.min(240, state.player.shield + 36 + stageNumber);
  if (stageNumber % 10 === 0) {
    state.player.lives = Math.min(9, state.player.lives + 1);
  }
}

function beginStage(stageNumber, initial = false) {
  const profile = getBossProfile(stageNumber);
  state.stageNumber = stageNumber;
  state.stageScore = 0;
  state.stageTarget = getStageTarget(stageNumber);
  state.stageWaveTimer = 0;
  state.stageMinFrames = getStageMinFrames(stageNumber);
  state.enemySpawnTimer = 30;
  state.stageTransition = 0;
  state.stageIntroTimer = initial ? 120 : 135;
  state.stageState = "wave";
  state.nextStage = clamp(stageNumber + 1, 1, TOTAL_STAGES);
  state.previewBossName = profile.name;
  state.previewThreatLabel = profile.threatLabel;
  state.pendingBossSpawn = false;
  state.boss = null;
  clearBattlefield();

  if (!initial) {
    applyStageReward(stageNumber);
  }

  setStatus(
    `STAGE ${stageNumber} / ${TOTAL_STAGES} 開始。次のボスは ${profile.name}。`,
    200
  );
}

function resetGame() {
  state.frame = 0;
  state.score = 0;
  state.totalKills = 0;
  state.nextPickupIndex = 0;
  state.effects = [];
  state.cameraShake = 0;
  state.messageTimer = 0;
  state.finalVictory = false;
  resetScoreSubmission();
  resetPlayer();
  createStars();
  beginStage(1, true);
  syncHud();
}

function getPlayerSpeed() {
  return 6.2 + state.player.speedLevel * 1.25;
}

function syncHud() {
  const scoreProgress = state.stageTarget > 0 ? state.stageScore / state.stageTarget : 0;
  const timeProgress = state.stageMinFrames > 0 ? state.stageWaveTimer / state.stageMinFrames : 0;
  const stageProgress = state.boss ? 100 : Math.min(100, Math.min(scoreProgress, timeProgress) * 100);

  ui.score.textContent = state.score.toLocaleString("ja-JP");
  ui.lives.textContent = String(state.player.lives);
  ui.shield.textContent = String(Math.max(0, Math.round(state.player.shield)));
  ui.weapon.textContent = state.player.laserLevel > 0 ? `Laser Lv.${state.player.laserLevel}` : "Pulse";
  ui.stageNumber.textContent = `${state.stageNumber} / ${TOTAL_STAGES}`;
  ui.threat.textContent = state.boss ? state.boss.name : state.previewBossName;
  ui.stageValue.textContent = state.boss ? "BOSS" : `${Math.round(stageProgress)}%`;
  ui.stageBar.style.width = `${stageProgress}%`;
}

function startGame() {
  unlockAudio();
  resetGame();
  state.mode = "running";
  playBgm(true);
  playSfx("alert", { volume: 0.45, rate: 1.06 });
  setStatus("Mission Start. Stage 1 から Stage 100 まで突破してください。", 180);
}

function togglePause() {
  if (state.mode === "running") {
    state.mode = "paused";
    pauseBgm();
    setStatus("Paused. 再開するには Pause か P キーを押してください。", 999999);
  } else if (state.mode === "paused") {
    state.mode = "running";
    playBgm();
    setStatus(`再出撃。Stage ${state.stageNumber} を継続します。`, 120);
  }
}

function spawnEnemyProjectile(config) {
  if (state.enemyBullets.length >= getEnemyBulletLimit(state.stageNumber)) {
    return;
  }

  state.enemyBullets.push({
    x: config.x,
    y: config.y,
    vx: config.vx,
    vy: config.vy,
    radius: config.radius ?? 6,
    damage: config.damage ?? 40,
    color: config.color ?? "rgba(255, 117, 96, 0.95)",
    life: config.life ?? 240,
    age: 0,
    turnRate: config.turnRate ?? 0,
    kind: config.kind ?? "orb",
    phase: config.phase ?? Math.random() * Math.PI * 2,
    pulse: config.pulse ?? 0,
    trailHue: config.trailHue ?? null,
    length: config.length ?? 0,
    thickness: config.thickness ?? 0,
    bounceY: config.bounceY ?? false,
    bouncesRemaining: config.bouncesRemaining ?? 0
  });
}

function fireEnemyAimed(origin, speed = 6, spread = 0, options = {}) {
  const dx = state.player.x - origin.x;
  const dy = state.player.y - origin.y + spread;
  const length = Math.hypot(dx, dy) || 1;
  spawnEnemyProjectile({
    x: origin.x,
    y: origin.y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: options.radius,
    damage: options.damage,
    color: options.color,
    life: options.life,
    turnRate: options.turnRate,
    kind: options.kind,
    pulse: options.pulse,
    trailHue: options.trailHue
  });
}

function fireEnemyAimedBurst(origin, count, speed, spread = 28, options = {}) {
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * spread;
    fireEnemyAimed(origin, speed, offset, options);
  }
}

function fireBossFan(origin, count, speed, spreadAngle, options = {}) {
  const startAngle = -spreadAngle / 2;
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const angle = startAngle + spreadAngle * ratio;
    const vx = -Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    spawnEnemyProjectile({
      x: origin.x,
      y: origin.y,
      vx,
      vy,
      radius: options.radius,
      damage: options.damage,
      color: options.color,
      life: options.life,
      kind: options.kind,
      pulse: options.pulse,
      trailHue: options.trailHue
    });
  }
}

function fireBossRing(origin, count, speed, options = {}) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    spawnEnemyProjectile({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: options.radius,
      damage: options.damage,
      color: options.color,
      life: options.life,
      kind: options.kind,
      pulse: options.pulse,
      trailHue: options.trailHue
    });
  }
}

function spawnPickup(x, y) {
  const kind = pickupOrder[state.nextPickupIndex % pickupOrder.length];
  state.nextPickupIndex += 1;
  state.pickups.push({
    kind,
    x,
    y,
    width: 30,
    height: 30,
    vx: -3.6,
    vy: Math.sin(state.frame * 0.08) * 0.8,
    age: 0
  });
}

function addEffect(x, y, color, size = 24, count = 8) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.45;
    const speed = Math.random() * 3.2 + 1.2;
    state.effects.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 18,
      size: Math.random() * size + 6,
      color
    });
  }
}

function applyPickup(kind) {
  playSfx("pickup", { volume: 0.48, rate: kind === "speed" ? 1.14 : 1 });
  if (kind === "speed") {
    state.player.speedLevel = Math.min(5, state.player.speedLevel + 1);
    setStatus(`Speed Up 回収。機動力が Lv.${state.player.speedLevel} に上昇。`, 180);
  } else if (kind === "wingman") {
    state.player.wingmen = Math.min(2, state.player.wingmen + 1);
    setStatus(`子機を追加。現在 ${state.player.wingmen} 基が随伴中。`, 180);
  } else if (kind === "laser") {
    state.player.laserLevel = Math.min(4, state.player.laserLevel + 1);
    setStatus(`レーザ起動。Laser Lv.${state.player.laserLevel} へ強化。`, 180);
  } else if (kind === "shield") {
    state.player.shield = Math.min(240, state.player.shield + 90);
    setStatus("シールド展開。被弾を吸収します。", 180);
  }
}

function firePlayerBurst(sourceX, sourceY, powerScale = 1) {
  if (state.player.laserLevel > 0) {
    state.bullets.push({
      type: "laser",
      x: sourceX + 34,
      y: sourceY,
      vx: 18,
      vy: 0,
      width: 54 + state.player.laserLevel * 16,
      height: 7 + state.player.laserLevel * 2,
      damage: (24 + state.player.laserLevel * 10) * powerScale,
      life: 38,
      pierce: 5 + state.player.laserLevel,
      color: "rgba(106, 245, 255, 0.9)"
    });
  } else {
    const spread = 10;
    state.bullets.push({
      type: "pulse",
      x: sourceX + 28,
      y: sourceY - spread,
      vx: 13,
      vy: -0.3,
      width: 18,
      height: 5,
      damage: 20 * powerScale,
      life: 48,
      pierce: 1,
      color: "rgba(120, 228, 255, 0.9)"
    });
    state.bullets.push({
      type: "pulse",
      x: sourceX + 30,
      y: sourceY + spread,
      vx: 13,
      vy: 0.3,
      width: 18,
      height: 5,
      damage: 20 * powerScale,
      life: 48,
      pierce: 1,
      color: "rgba(120, 228, 255, 0.9)"
    });
  }
}

function getWingmanOffsets() {
  const offsets = [];
  const pulse = Math.sin(state.frame * 0.07) * 12;
  if (state.player.wingmen >= 1) {
    offsets.push({ x: -30, y: -48 + pulse * 0.35 });
  }
  if (state.player.wingmen >= 2) {
    offsets.push({ x: -30, y: 48 - pulse * 0.35 });
  }
  return offsets;
}

function firePlayerWeapons() {
  const cooldownBase = state.player.laserLevel > 0 ? 13 : 8;
  if (state.player.cooldown > 0 || state.stageTransition > 0) {
    return;
  }

  playSfx(state.player.laserLevel > 0 ? "laser" : "shot", {
    volume: state.player.laserLevel > 0 ? 0.32 : 0.22,
    rate: state.player.laserLevel > 0 ? 1 : 1.08
  });

  firePlayerBurst(state.player.x + 34, state.player.y, 1);
  getWingmanOffsets().forEach((offset, index) => {
    firePlayerBurst(state.player.x + offset.x + 12, state.player.y + offset.y, 0.72 + index * 0.08);
  });

  state.player.cooldown = Math.max(4, cooldownBase - state.player.wingmen);
}

function getEnemyTypesForStage(stageNumber) {
  const types = ["fighter", "raider", "frigate"];
  if (stageNumber >= 12) {
    types.push("interceptor");
  }
  if (stageNumber >= 35) {
    types.push("carrier");
  }
  return types;
}

function spawnEnemy() {
  const stageNumber = state.stageNumber;
  const difficulty = getStageDifficulty(stageNumber);
  const speedMultiplier = 1 + (stageNumber - 1) * 0.003;
  const types = getEnemyTypesForStage(stageNumber);
  const type = types[Math.floor(Math.random() * types.length)];
  const y = 80 + Math.random() * (canvas.height - 160);
  const seed = Math.random() * Math.PI * 2;

  const baseEnemy = {
    type,
    x: canvas.width + 180 + Math.random() * 90,
    y,
    seed,
    age: 0,
    fireCooldown: 40
  };

  if (type === "fighter") {
    state.enemies.push({
      ...baseEnemy,
      width: 104,
      height: 52,
      hp: 28 + stageNumber * 4,
      maxHp: 28 + stageNumber * 4,
      speed: (5.8 + difficulty * 0.55) * speedMultiplier,
      fireRate: Math.max(24, 110 - Math.floor(stageNumber * 0.85)),
      score: 70 + stageNumber * 4,
      progressValue: 58 + stageNumber * 2,
      touchDamage: 40
    });
  } else if (type === "raider") {
    state.enemies.push({
      ...baseEnemy,
      width: 120,
      height: 62,
      hp: 46 + stageNumber * 6,
      maxHp: 46 + stageNumber * 6,
      speed: (4.1 + difficulty * 0.42) * speedMultiplier,
      fireRate: Math.max(24, 92 - Math.floor(stageNumber * 0.65)),
      score: 110 + stageNumber * 6,
      progressValue: 80 + stageNumber * 2.4,
      touchDamage: 48
    });
  } else if (type === "frigate") {
    state.enemies.push({
      ...baseEnemy,
      width: 156,
      height: 88,
      hp: 96 + stageNumber * 12,
      maxHp: 96 + stageNumber * 12,
      speed: (2.8 + difficulty * 0.24) * speedMultiplier,
      fireRate: Math.max(22, 62 - Math.floor(stageNumber * 0.32)),
      score: 180 + stageNumber * 9,
      progressValue: 120 + stageNumber * 3,
      touchDamage: 58
    });
  } else if (type === "interceptor") {
    state.enemies.push({
      ...baseEnemy,
      width: 92,
      height: 46,
      hp: 36 + stageNumber * 5,
      maxHp: 36 + stageNumber * 5,
      speed: (6.8 + difficulty * 0.7) * speedMultiplier,
      fireRate: Math.max(20, 76 - Math.floor(stageNumber * 0.55)),
      score: 125 + stageNumber * 7,
      progressValue: 72 + stageNumber * 2.2,
      touchDamage: 44
    });
  } else {
    state.enemies.push({
      ...baseEnemy,
      width: 168,
      height: 98,
      hp: 120 + stageNumber * 14,
      maxHp: 120 + stageNumber * 14,
      speed: (2.3 + difficulty * 0.18) * speedMultiplier,
      fireRate: Math.max(24, 70 - Math.floor(stageNumber * 0.35)),
      score: 210 + stageNumber * 11,
      progressValue: 132 + stageNumber * 3.4,
      touchDamage: 64
    });
  }
}

function createBoss(stageNumber) {
  const difficulty = getStageDifficulty(stageNumber);
  const profile = getBossProfile(stageNumber);
  const hp = Math.round(650 + stageNumber * 75 + stageNumber * stageNumber * 7.5);
  const baseX = 910 - Math.min(120, stageNumber * 1.6);
  const width = clamp(350 + stageNumber * 1.8, 350, 600);
  const height = clamp(180 + stageNumber * 0.85, 180, 320);

  return {
    stage: stageNumber,
    name: profile.name,
    threatLabel: profile.threatLabel,
    movementIndex: profile.movementIndex,
    attackIndex: profile.attackIndex,
    visualIndex: profile.visualIndex,
    hullIndex: profile.hullIndex,
    wingIndex: profile.wingIndex,
    coreIndex: profile.coreIndex,
    podIndex: profile.podIndex,
    armorIndex: profile.armorIndex,
    hue: profile.hue,
    accent: `hsl(${profile.hue} 92% 65%)`,
    accentGlow: `hsla(${profile.hue} 92% 65% / 0.32)`,
    x: canvas.width + width,
    y: canvas.height / 2,
    targetX: baseX,
    targetY: canvas.height / 2,
    baseX,
    width,
    height,
    hp,
    maxHp: hp,
    intro: true,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    fireCooldown: Math.max(14, 54 - Math.floor((stageNumber - 1) * 0.4)),
    patternCooldown: Math.max(44, 120 - Math.floor((stageNumber - 1) * 0.7)),
    specialCooldown: Math.max(80, 240 - Math.floor((stageNumber - 1) * 1.4)),
    barrageCooldown: Math.max(48, 120 - stageNumber * 0.4),
    barrageVolley: 0,
    laserCooldown: Math.max(48, 132 - stageNumber * 0.55),
    laserVolley: 0,
    retargetTimer: 70,
    dashMode: "idle",
    dashClock: 0,
    orbitAngle: Math.random() * Math.PI * 2,
    beamCharge: 0,
    beamActive: 0,
    beamY: canvas.height / 2,
    beamSweep: 0,
    difficulty
  };
}

function spawnBoss() {
  if (state.boss || state.stageState !== "wave") {
    return;
  }

  state.stageState = "boss";
  clearBattlefield();
  state.boss = createBoss(state.stageNumber);
  playSfx("alert", { volume: 0.72, rate: 0.88 });
  setStatus(
    `WARNING. Stage ${state.stageNumber} Boss ${state.boss.name} 出現。`,
    260
  );
}

function startStageTransition() {
  state.stageTransition = 180;
  state.stageState = "transition";
  clearBattlefield();
}

function hitPlayer(damage = 50) {
  if (state.player.invulnerability > 0 || state.mode !== "running") {
    return;
  }

  if (state.player.shield > 0) {
    state.player.shield = Math.max(0, state.player.shield - damage);
    state.player.invulnerability = 18;
    state.cameraShake = 8;
    playSfx("hit", { volume: 0.3, rate: 1.28 });
    addEffect(state.player.x + 12, state.player.y, "rgba(152, 222, 255, 0.7)", 16, 9);
    setStatus("シールドが衝撃を吸収。", 60);
    return;
  }

  state.player.lives -= 1;
  state.player.invulnerability = 90;
  state.player.hitFlash = 30;
  state.cameraShake = 18;
  playSfx("hit", { volume: 0.5, rate: 0.86 });
  addEffect(state.player.x + 12, state.player.y, "rgba(255, 132, 98, 0.7)", 24, 12);

  if (state.player.lives <= 0) {
    state.mode = "gameover";
    pauseBgm(true);
    playSfx("failure", { volume: 0.68, rate: 1 });
    prepareScoreSubmission();
    setStatus("Mission Failed. Restart で Stage 1 から再挑戦できます。", 999999);
  } else {
    setStatus(`被弾。残機 ${state.player.lives}。`, 120);
  }
}

function destroyEnemy(enemy) {
  state.score += enemy.score;
  state.totalKills += 1;
  state.stageScore += enemy.progressValue;
  playSfx("explosion", {
    volume: enemy.type === "frigate" || enemy.type === "carrier" ? 0.5 : 0.28,
    rate: enemy.type === "fighter" || enemy.type === "interceptor" ? 1.14 : enemy.type === "raider" ? 1 : 0.84
  });
  addEffect(enemy.x, enemy.y, "rgba(255, 124, 96, 0.7)", enemy.width > 150 ? 30 : 20, 12);

  const pickupChance = 0.08 + state.stageNumber * 0.001;
  if (state.totalKills % 5 === 0 || Math.random() < pickupChance) {
    spawnPickup(enemy.x, enemy.y);
  }

  if (isStageWaveComplete() && !state.boss) {
    state.pendingBossSpawn = true;
  }
}

function destroyBoss() {
  const currentStage = state.stageNumber;
  state.score += 2500 + currentStage * 120;
  addEffect(state.boss.x - 80, state.boss.y, "rgba(255, 140, 90, 0.82)", 72, 24);
  playSfx("explosion", { volume: 0.78, rate: 0.72 });
  playSfx("victory", { volume: 0.8, rate: 1 });

  if (currentStage >= TOTAL_STAGES) {
    state.boss = null;
    state.mode = "victory";
    state.finalVictory = true;
    pauseBgm(true);
    prepareScoreSubmission();
    setStatus("Stage 100 Boss Down. Campaign Complete.", 999999);
    return;
  }

  state.boss = null;
  startStageTransition();
  setStatus(
    `STAGE ${currentStage} CLEAR. 次は STAGE ${currentStage + 1}。`,
    220
  );
}

function intersectsRect(a, b) {
  return (
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2
  );
}

function rectCircleHit(rect, circle) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function updatePlayer() {
  const speed = getPlayerSpeed();
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowUp") || keys.has("KeyW")) {
    dy -= 1;
  }
  if (keys.has("ArrowDown") || keys.has("KeyS")) {
    dy += 1;
  }
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    dx -= 1;
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    dx += 1;
  }

  if (pointer.active) {
    state.player.x += (pointer.x - state.player.x) * 0.14;
    state.player.y += (pointer.y - state.player.y) * 0.14;
  } else if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy) || 1;
    state.player.x += (dx / length) * speed;
    state.player.y += (dy / length) * speed;
  }

  state.player.x = clamp(state.player.x, 90, canvas.width - 120);
  state.player.y = clamp(state.player.y, 72, canvas.height - 72);
  state.player.cooldown = Math.max(0, state.player.cooldown - 1);
  state.player.invulnerability = Math.max(0, state.player.invulnerability - 1);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - 1);

  if (keys.has("Space") || keys.has("Enter") || pointer.active) {
    firePlayerWeapons();
  }
}

function updateBullets() {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life -= 1;

    for (const enemy of state.enemies) {
      if (bullet.life > 0 && intersectsRect(bullet, enemy)) {
        enemy.hp -= bullet.damage;
        bullet.pierce -= 1;
        addEffect(bullet.x, bullet.y, "rgba(119, 237, 255, 0.45)", 8, 4);
        if (enemy.hp <= 0) {
          destroyEnemy(enemy);
        }
        if (bullet.pierce <= 0) {
          bullet.life = 0;
          break;
        }
      }
    }

    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

    if (state.boss && bullet.life > 0 && !bullet.bossHit) {
      const bossHitbox = {
        x: state.boss.x - 36,
        y: state.boss.y,
        width: state.boss.width * 0.84,
        height: state.boss.height * 0.72
      };
      if (intersectsRect(bullet, bossHitbox)) {
        bullet.bossHit = true;
        state.boss.hp -= bullet.damage;
        bullet.pierce -= 1;
        addEffect(bullet.x, bullet.y, "rgba(255, 147, 90, 0.36)", 12, 4);
        if (state.boss.hp <= 0) {
          destroyBoss();
          return false;
        }
        if (bullet.pierce <= 0) {
          bullet.life = 0;
        }
      }
    }

    return bullet.life > 0 && bullet.x < canvas.width + 200 && bullet.y > -120 && bullet.y < canvas.height + 120;
  });
}

function updateEnemies() {
  if (state.boss || state.stageTransition > 0 || state.stageState !== "wave" || state.stageIntroTimer > 0) {
    return;
  }

  state.stageWaveTimer += 1;
  state.enemySpawnTimer -= 1;
  const stageNumber = state.stageNumber;
  const baseRate = Math.max(18, 52 - Math.floor(stageNumber * 0.32));
  if (state.enemySpawnTimer <= 0) {
    const waveSize = getEnemyWaveSize(stageNumber);
    for (let index = 0; index < waveSize && state.enemies.length < getEnemyCap(stageNumber); index += 1) {
      spawnEnemy();
    }
    state.enemySpawnTimer = baseRate + Math.floor(Math.random() * 12);
  }

  state.enemies.forEach((enemy) => {
    enemy.age += 1;
    enemy.fireCooldown -= 1;

    if (enemy.type === "fighter") {
      enemy.x -= enemy.speed;
      enemy.y += Math.sin(enemy.age * 0.16 + enemy.seed) * 2.6;
    } else if (enemy.type === "raider") {
      enemy.x -= enemy.speed + Math.sin(enemy.age * 0.08 + enemy.seed) * 0.8;
      enemy.y += Math.cos(enemy.age * 0.18 + enemy.seed) * 3.4;
    } else if (enemy.type === "frigate") {
      enemy.x -= enemy.speed;
      enemy.y += Math.sin(enemy.age * 0.04 + enemy.seed) * 1.4;
    } else if (enemy.type === "interceptor") {
      enemy.x -= enemy.speed + Math.cos(enemy.age * 0.24 + enemy.seed) * 1.4;
      enemy.y += Math.sin(enemy.age * 0.32 + enemy.seed) * 5.2;
    } else if (enemy.type === "carrier") {
      enemy.x -= enemy.speed;
      enemy.y += Math.sin(enemy.age * 0.05 + enemy.seed) * 2.2;
      if (enemy.age % 180 === 0 && Math.random() < 0.6) {
        state.enemies.push({
          type: "fighter",
          x: enemy.x - 30,
          y: enemy.y + (Math.random() - 0.5) * 70,
          seed: Math.random() * Math.PI * 2,
          age: 0,
          fireCooldown: 30,
          width: 92,
          height: 46,
          hp: 24 + state.stageNumber * 3,
          maxHp: 24 + state.stageNumber * 3,
          speed: 5.8 + getStageDifficulty(state.stageNumber) * 0.45,
          fireRate: Math.max(36, 90 - state.stageNumber),
          score: 70 + state.stageNumber * 4,
          progressValue: 48 + state.stageNumber * 1.6,
          touchDamage: 36
        });
      }
    }

    if (enemy.fireCooldown <= 0) {
      const muzzle = { x: enemy.x - enemy.width / 2, y: enemy.y };
      const bulletSpeed = 4.8 + state.stageNumber * 0.038;
      const bulletTier = Math.floor((stageNumber - 1) / 12);
      if (enemy.type === "fighter") {
        const count = Math.min(5, 1 + Math.floor(bulletTier / 2));
        fireEnemyAimedBurst(muzzle, count, bulletSpeed + 1.6, 24, {
          radius: 5,
          damage: 36 + stageNumber * 0.55
        });
      } else if (enemy.type === "raider") {
        const count = Math.min(11, 3 + Math.floor(bulletTier / 2) * 2);
        fireEnemyAimedBurst(muzzle, count, bulletSpeed + 0.5, 24, {
          radius: 6,
          damage: 38 + stageNumber * 0.62
        });
      } else if (enemy.type === "frigate") {
        fireBossFan(muzzle, Math.min(15, 5 + bulletTier), bulletSpeed + 0.2, Math.min(2.2, 1.1 + bulletTier * 0.1), {
          radius: 7,
          damage: 44 + state.stageNumber,
          color: "rgba(255, 174, 98, 0.92)"
        });
      } else if (enemy.type === "interceptor") {
        const count = Math.min(5, 1 + Math.floor(bulletTier / 2));
        fireEnemyAimedBurst(muzzle, count, bulletSpeed + 2.4, 20, {
          radius: 5,
          turnRate: 0.018,
          color: "rgba(255, 126, 126, 0.96)"
        });
      } else if (enemy.type === "carrier") {
        fireBossFan(muzzle, Math.min(18, 6 + bulletTier), bulletSpeed, Math.min(2.5, 1.4 + bulletTier * 0.11), {
          radius: 7,
          damage: 44 + state.stageNumber,
          color: "rgba(255, 148, 120, 0.92)"
        });
      }
      enemy.fireCooldown = enemy.fireRate + Math.random() * 16;
    }

    if (enemy.x < -220) {
      enemy.hp = 0;
    }

    if (intersectsRect(
      { x: state.player.x, y: state.player.y, width: state.player.width * 0.62, height: state.player.height * 0.52 },
      enemy
    )) {
      enemy.hp = 0;
      hitPlayer(enemy.touchDamage);
    }
  });

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (isStageWaveComplete() && !state.boss) {
    state.pendingBossSpawn = true;
  }
}

function updateBossMovement(boss) {
  const centerY = canvas.height / 2;
  const leftLimit = 620;
  const rightLimit = 1020;

  switch (boss.movementIndex) {
    case 0:
      boss.targetX = boss.baseX + Math.sin(boss.age * 0.017) * 80;
      boss.targetY = centerY + Math.sin(boss.age * 0.031 + boss.phase) * 150;
      break;
    case 1:
      boss.targetX = boss.baseX + Math.cos(boss.age * 0.018) * 60;
      boss.targetY = centerY + Math.sin(boss.age * 0.06 + boss.phase) * 210;
      break;
    case 2:
      boss.retargetTimer -= 1;
      if (boss.retargetTimer <= 0) {
        boss.retargetTimer = Math.max(24, 74 - Math.floor(boss.stage * 0.18));
        boss.targetX = clamp(boss.baseX + (Math.random() - 0.5) * 220, leftLimit, rightLimit);
        boss.targetY = 120 + Math.random() * (canvas.height - 240);
      }
      break;
    case 3:
      if (boss.dashMode === "idle") {
        boss.dashClock -= 1;
        if (boss.dashClock <= 0) {
          boss.dashMode = "strike";
          boss.dashClock = 34;
          boss.targetX = 640;
          boss.targetY = clamp(state.player.y, 120, canvas.height - 120);
        } else {
          boss.targetX = boss.baseX + Math.sin(boss.age * 0.02) * 50;
          boss.targetY = centerY + Math.sin(boss.age * 0.03) * 110;
        }
      } else if (boss.dashMode === "strike") {
        boss.targetX = 640;
        boss.targetY = clamp(state.player.y, 120, canvas.height - 120);
        boss.dashClock -= 1;
        if (boss.dashClock <= 0) {
          boss.dashMode = "recover";
          boss.dashClock = 44;
        }
      } else {
        boss.targetX = boss.baseX;
        boss.targetY = centerY;
        boss.dashClock -= 1;
        if (boss.dashClock <= 0) {
          boss.dashMode = "idle";
          boss.dashClock = Math.max(80, 180 - boss.stage);
        }
      }
      break;
    case 4:
      boss.targetX = boss.baseX + Math.cos(boss.age * 0.012) * 28;
      boss.targetY = centerY + Math.sin(boss.age * 0.024) * 75;
      break;
    case 5:
      boss.targetX = boss.baseX + Math.sin(boss.age * 0.013 + Math.sin(boss.age * 0.008)) * 92;
      boss.targetY = centerY + Math.sin(boss.age * 0.05 + boss.phase) * 185;
      break;
    case 6:
      if (boss.dashMode === "idle") {
        boss.dashClock -= 1;
        boss.targetX = boss.baseX + Math.sin(boss.age * 0.025) * 80;
        boss.targetY = centerY + Math.cos(boss.age * 0.028) * 120;
        if (boss.dashClock <= 0) {
          boss.dashMode = "crush";
          boss.dashClock = 28;
        }
      } else {
        boss.targetX = 700;
        boss.targetY = centerY + Math.sin(boss.age * 0.06) * 90;
        boss.dashClock -= 1;
        if (boss.dashClock <= 0) {
          boss.dashMode = "idle";
          boss.dashClock = Math.max(90, 170 - boss.stage);
        }
      }
      break;
    case 7:
      boss.targetX = boss.baseX + Math.sin(boss.age * 0.014) * 42;
      boss.targetY = lerp(boss.targetY, clamp(state.player.y, 120, canvas.height - 120), 0.08) + Math.sin(boss.age * 0.05) * 34;
      break;
    case 8:
      boss.orbitAngle += 0.028;
      boss.targetX = boss.baseX + Math.cos(boss.orbitAngle) * 82;
      boss.targetY = centerY + Math.sin(boss.orbitAngle * 1.4) * 170;
      break;
    default:
      boss.retargetTimer -= 1;
      if (boss.retargetTimer <= 0) {
        boss.retargetTimer = Math.max(20, 60 - Math.floor(boss.stage * 0.15));
        boss.targetX = clamp(boss.baseX + (Math.random() - 0.5) * 200, leftLimit, rightLimit);
        boss.targetY = 120 + Math.random() * (canvas.height - 240);
      }
      boss.targetX += Math.sin(boss.age * 0.12 + boss.phase) * 0.6;
      boss.targetY += Math.cos(boss.age * 0.1 + boss.phase) * 0.5;
      break;
  }

  boss.targetX = clamp(boss.targetX, leftLimit, rightLimit);
  boss.targetY = clamp(boss.targetY, 110, canvas.height - 110);
  const movementSpeed = Math.min(0.16, 0.08 + (boss.stage - 1) * 0.0008);
  boss.x = lerp(boss.x, boss.targetX, boss.movementIndex === 6 && boss.dashMode === "crush" ? 0.2 : movementSpeed);
  boss.y = lerp(boss.y, boss.targetY, movementSpeed);
}

function updateBossEscalationBarrage(boss) {
  if (boss.stage < 6 || boss.barrageCooldown > 0) {
    return;
  }

  const tier = Math.floor((boss.stage - 1) / 8);
  const count = Math.min(16, 2 + tier);
  const speed = 4.8 + boss.stage * 0.035;
  const spread = Math.min(2.45, 0.9 + tier * 0.12);
  const origin = { x: boss.x - boss.width * 0.44, y: boss.y };

  fireBossFan(origin, count, speed, spread, {
    radius: 5 + Math.min(3, Math.floor(boss.stage / 35)),
    damage: 38 + boss.stage * 0.9,
    color: `hsla(${(boss.hue + 28) % 360} 96% 68% / 0.94)`,
    kind: "bossBarrage",
    trailHue: boss.hue
  });

  if (boss.stage >= 55 && boss.barrageVolley % 3 === 2) {
    fireBossRing(origin, Math.min(24, 8 + Math.floor(boss.stage / 5)), 3.8 + boss.stage * 0.025, {
      radius: 5,
      damage: 34 + boss.stage * 0.75,
      color: `hsla(${(boss.hue + 90) % 360} 96% 70% / 0.9)`,
      kind: "bossBarrage",
      trailHue: (boss.hue + 90) % 360
    });
  }

  boss.barrageVolley += 1;
  boss.barrageCooldown = Math.max(48, 145 - boss.stage * 0.62);
}

function updateBossLaserMatrix(boss) {
  if (boss.stage < 20 || boss.laserCooldown > 0) {
    return;
  }

  const tier = Math.floor((boss.stage - 20) / 10);
  const enraged = boss.hp / boss.maxHp < 0.5 ? 1 : 0;
  const count = Math.min(10, 2 + tier + enraged);
  const speed = 6.4 + boss.stage * 0.032;
  const spread = Math.min(1.9, 0.58 + tier * 0.14);
  const bounceCount = Math.min(6, 1 + Math.floor((boss.stage - 20) / 15));
  const pattern = boss.laserVolley % 3;
  const originX = boss.x - boss.width * 0.43;

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const offset = ratio - 0.5;
    const originY = boss.y + offset * Math.min(180, boss.height * 0.72);
    const aimedAngle = Math.atan2(state.player.y - originY, state.player.x - originX);
    let angle;

    if (pattern === 0) {
      angle = aimedAngle + offset * spread;
    } else if (pattern === 1) {
      angle = Math.PI + offset * (1.25 + tier * 0.09);
    } else {
      const direction = index % 2 === 0 ? -1 : 1;
      angle = Math.PI + direction * (0.3 + Math.abs(offset) * (0.8 + tier * 0.05));
    }

    spawnEnemyProjectile({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 8,
      length: Math.min(150, 72 + boss.stage * 0.65),
      thickness: Math.min(18, 8 + Math.floor(boss.stage / 12)),
      damage: 50 + boss.stage * 0.65,
      color: `hsla(${(boss.hue + index * 17) % 360} 100% 70% / 0.96)`,
      kind: "laser",
      life: 360,
      bounceY: true,
      bouncesRemaining: bounceCount,
      trailHue: (boss.hue + index * 17) % 360
    });
  }

  playSfx("beam", { volume: 0.34, rate: 1 + tier * 0.025 });
  boss.laserVolley += 1;
  const baseCooldown = Math.max(42, 126 - boss.stage * 0.7);
  boss.laserCooldown = enraged ? baseCooldown * 0.78 : baseCooldown;
}

function updateBossAttackStyle(boss) {
  const stageScale = boss.stage;
  const hpPressure = 1 - boss.hp / boss.maxHp;
  const enrageScale = Math.min(0.7, Math.max(0, boss.stage - 1) * 0.007);
  const attackTempo = 1 + Math.max(0, boss.stage - 1) * 0.006 + hpPressure * enrageScale;
  boss.fireCooldown -= attackTempo;
  boss.patternCooldown -= attackTempo;
  boss.specialCooldown -= attackTempo;
  boss.barrageCooldown -= attackTempo;
  boss.laserCooldown -= attackTempo;

  if (boss.attackIndex === 0) {
    if (boss.fireCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 180, y: boss.y }, 6.2 + stageScale * 0.05);
      fireEnemyAimed({ x: boss.x - 210, y: boss.y - 60 }, 6.0 + stageScale * 0.04);
      fireEnemyAimed({ x: boss.x - 210, y: boss.y + 60 }, 6.0 + stageScale * 0.04);
      boss.fireCooldown = Math.max(18, 42 - Math.floor(stageScale * 0.08));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 220, y: boss.y }, 5, 5.4 + stageScale * 0.04, 1.1, {
        radius: 7,
        damage: 42 + stageScale,
        color: "rgba(255, 188, 122, 0.92)"
      });
      boss.patternCooldown = Math.max(58, 112 - Math.floor(stageScale * 0.25));
    }
  } else if (boss.attackIndex === 1) {
    if (boss.fireCooldown <= 0) {
      fireBossFan({ x: boss.x - 210, y: boss.y }, 7, 5.4 + stageScale * 0.05, 1.6, {
        radius: 7,
        damage: 44 + stageScale,
        color: "rgba(255, 142, 122, 0.94)"
      });
      boss.fireCooldown = Math.max(26, 62 - Math.floor(stageScale * 0.15));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 240, y: boss.y - 80 }, 4, 6.2 + stageScale * 0.04, 0.9, {
        radius: 6,
        damage: 40 + stageScale,
        color: "rgba(255, 214, 138, 0.9)"
      });
      fireBossFan({ x: boss.x - 240, y: boss.y + 80 }, 4, 6.2 + stageScale * 0.04, 0.9, {
        radius: 6,
        damage: 40 + stageScale,
        color: "rgba(255, 214, 138, 0.9)"
      });
      boss.patternCooldown = Math.max(76, 136 - Math.floor(stageScale * 0.18));
    }
  } else if (boss.attackIndex === 2) {
    if (boss.fireCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 190, y: boss.y - 50 }, 6.0 + stageScale * 0.04);
      fireEnemyAimed({ x: boss.x - 190, y: boss.y + 50 }, 6.0 + stageScale * 0.04);
      boss.fireCooldown = Math.max(18, 48 - Math.floor(stageScale * 0.1));
    }
    if (boss.beamActive > 0) {
      boss.beamActive -= 1;
      boss.beamY += boss.beamSweep || 2.4;
      if (boss.beamY < 110 || boss.beamY > canvas.height - 110) {
        boss.beamSweep *= -1;
      }
      if (rectCircleHit(
        { x: 0, y: boss.beamY - 28, width: boss.x - 120, height: 56 },
        { x: state.player.x, y: state.player.y, radius: 26 }
      )) {
        hitPlayer(72 + stageScale);
      }
    } else if (boss.specialCooldown <= 0) {
      boss.beamCharge += 1;
      if (boss.beamCharge === 1) {
        setStatus(`警告: ${boss.name} が掃射主砲を展開。`, 80);
      }
      if (boss.beamCharge > 42) {
        boss.beamActive = 88;
        boss.beamY = boss.y;
        boss.beamSweep = Math.random() > 0.5 ? 2.8 : -2.8;
        boss.beamCharge = 0;
        boss.specialCooldown = Math.max(120, 260 - stageScale);
        playSfx("beam", { volume: 0.58, rate: 0.92 });
      }
    }
  } else if (boss.attackIndex === 3) {
    if (boss.fireCooldown <= 0) {
      for (let index = 0; index < 3; index += 1) {
        spawnEnemyProjectile({
          x: canvas.width + 30 + index * 80,
          y: -20 + index * 40,
          vx: -4.8 - stageScale * 0.02,
          vy: 3.0 + index * 0.55,
          radius: 8,
          damage: 44 + stageScale,
          color: "rgba(255, 171, 99, 0.92)",
          kind: "meteor",
          life: 240
        });
      }
      boss.fireCooldown = Math.max(18, 34 - Math.floor(stageScale * 0.05));
    }
    if (boss.patternCooldown <= 0) {
      for (let index = 0; index < 8; index += 1) {
        spawnEnemyProjectile({
          x: canvas.width + Math.random() * 120,
          y: Math.random() * canvas.height,
          vx: -5.4 - Math.random() * 1.8,
          vy: (Math.random() - 0.5) * 3,
          radius: 6 + Math.random() * 2,
          damage: 40 + stageScale,
          color: "rgba(255, 130, 103, 0.88)",
          kind: "meteor",
          life: 220
        });
      }
      boss.patternCooldown = Math.max(72, 126 - Math.floor(stageScale * 0.18));
    }
  } else if (boss.attackIndex === 4) {
    if (boss.fireCooldown <= 0) {
      fireBossRing({ x: boss.x - 140, y: boss.y }, 10, 3.2 + stageScale * 0.03, {
        radius: 6,
        damage: 42 + stageScale,
        color: "rgba(255, 132, 195, 0.9)",
        kind: "spiral",
        trailHue: boss.hue
      });
      boss.fireCooldown = Math.max(28, 60 - Math.floor(stageScale * 0.12));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 220, y: boss.y }, 9, 5.0 + stageScale * 0.03, 2.2, {
        radius: 5,
        damage: 38 + stageScale,
        color: "rgba(255, 215, 146, 0.88)"
      });
      boss.patternCooldown = Math.max(80, 128 - Math.floor(stageScale * 0.15));
    }
  } else if (boss.attackIndex === 5) {
    if (boss.fireCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 210, y: boss.y }, 8.4 + stageScale * 0.04, 0, {
        radius: 7,
        damage: 56 + stageScale,
        color: "rgba(255, 100, 100, 0.96)",
        turnRate: 0.022,
        kind: "sniper"
      });
      boss.fireCooldown = Math.max(34, 78 - Math.floor(stageScale * 0.12));
    }
    if (boss.patternCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 240, y: boss.y - 70 }, 7.2 + stageScale * 0.03, 0, {
        radius: 6,
        damage: 48 + stageScale,
        color: "rgba(255, 162, 126, 0.92)"
      });
      fireEnemyAimed({ x: boss.x - 240, y: boss.y + 70 }, 7.2 + stageScale * 0.03, 0, {
        radius: 6,
        damage: 48 + stageScale,
        color: "rgba(255, 162, 126, 0.92)"
      });
      boss.patternCooldown = Math.max(78, 136 - Math.floor(stageScale * 0.15));
    }
  } else if (boss.attackIndex === 6) {
    if (boss.fireCooldown <= 0) {
      const rows = 5 + Math.min(4, Math.floor(stageScale / 20));
      for (let row = 0; row < rows; row += 1) {
        spawnEnemyProjectile({
          x: canvas.width + 20,
          y: ((row + 1) / (rows + 1)) * canvas.height,
          vx: -4.2 - stageScale * 0.02,
          vy: Math.sin(row + boss.age * 0.1) * 0.8,
          radius: 7,
          damage: 42 + stageScale,
          color: "rgba(255, 186, 108, 0.92)",
          kind: "wall",
          life: 260
        });
      }
      boss.fireCooldown = Math.max(34, 72 - Math.floor(stageScale * 0.12));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 220, y: boss.y }, 8, 5.6 + stageScale * 0.03, 1.8, {
        radius: 5,
        damage: 36 + stageScale,
        color: "rgba(255, 128, 123, 0.92)"
      });
      boss.patternCooldown = Math.max(86, 140 - Math.floor(stageScale * 0.14));
    }
  } else if (boss.attackIndex === 7) {
    if (boss.fireCooldown <= 0) {
      for (let index = 0; index < 3; index += 1) {
        spawnEnemyProjectile({
          x: boss.x - 150 - index * 34,
          y: boss.y + (index - 1) * 60,
          vx: -2.6 - stageScale * 0.01,
          vy: (index - 1) * 0.45,
          radius: 12,
          damage: 48 + stageScale,
          color: "rgba(255, 118, 182, 0.9)",
          kind: "mine",
          life: 320,
          pulse: 2.6
        });
      }
      boss.fireCooldown = Math.max(38, 80 - Math.floor(stageScale * 0.1));
    }
    if (boss.patternCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 210, y: boss.y }, 6.6 + stageScale * 0.03, 0, {
        radius: 7,
        damage: 46 + stageScale,
        color: "rgba(255, 212, 130, 0.92)"
      });
      boss.patternCooldown = Math.max(60, 118 - Math.floor(stageScale * 0.2));
    }
  } else if (boss.attackIndex === 8) {
    if (boss.fireCooldown <= 0) {
      fireEnemyAimed({ x: boss.x - 230, y: boss.y - 95 }, 6.8 + stageScale * 0.03);
      fireEnemyAimed({ x: boss.x - 210, y: boss.y - 25 }, 6.4 + stageScale * 0.03, 18);
      fireEnemyAimed({ x: boss.x - 210, y: boss.y + 25 }, 6.4 + stageScale * 0.03, -18);
      fireEnemyAimed({ x: boss.x - 230, y: boss.y + 95 }, 6.8 + stageScale * 0.03);
      boss.fireCooldown = Math.max(24, 50 - Math.floor(stageScale * 0.08));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 240, y: boss.y - 80 }, 5, 5.5 + stageScale * 0.02, 1.2, {
        radius: 6,
        damage: 42 + stageScale,
        color: "rgba(255, 150, 118, 0.92)"
      });
      fireBossFan({ x: boss.x - 240, y: boss.y + 80 }, 5, 5.5 + stageScale * 0.02, 1.2, {
        radius: 6,
        damage: 42 + stageScale,
        color: "rgba(255, 150, 118, 0.92)"
      });
      boss.patternCooldown = Math.max(72, 126 - Math.floor(stageScale * 0.15));
    }
  } else {
    if (boss.fireCooldown <= 0) {
      fireBossRing({ x: boss.x - 150, y: boss.y }, 12, 3.8 + stageScale * 0.03, {
        radius: 6,
        damage: 44 + stageScale,
        color: "rgba(255, 140, 227, 0.92)",
        kind: "nova",
        trailHue: boss.hue
      });
      boss.fireCooldown = Math.max(34, 70 - Math.floor(stageScale * 0.1));
    }
    if (boss.patternCooldown <= 0) {
      fireBossFan({ x: boss.x - 240, y: boss.y }, 10, 6.0 + stageScale * 0.02, 2.3, {
        radius: 5,
        damage: 38 + stageScale,
        color: "rgba(255, 206, 130, 0.9)"
      });
      boss.patternCooldown = Math.max(82, 132 - Math.floor(stageScale * 0.14));
    }
  }

  updateBossEscalationBarrage(boss);
  updateBossLaserMatrix(boss);
}

function updateBoss() {
  if (!state.boss) {
    return;
  }

  const boss = state.boss;
  boss.age += 1;

  if (boss.intro) {
    boss.x = lerp(boss.x, boss.baseX, 0.045);
    boss.y = lerp(boss.y, canvas.height / 2, 0.06);
    if (Math.abs(boss.x - boss.baseX) < 5) {
      boss.intro = false;
      boss.dashClock = Math.max(70, 160 - boss.stage);
    }
    return;
  }

  updateBossMovement(boss);
  updateBossAttackStyle(boss);

  if (intersectsRect(
    { x: state.player.x, y: state.player.y, width: state.player.width * 0.56, height: state.player.height * 0.46 },
    { x: boss.x - 22, y: boss.y, width: boss.width * 0.84, height: boss.height * 0.72 }
  )) {
    hitPlayer(72 + boss.stage);
  }
}

function enemyLaserHitsPlayer(bullet) {
  const angle = Math.atan2(bullet.vy, bullet.vx);
  const dx = state.player.x - bullet.x;
  const dy = state.player.y - bullet.y;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  const halfLength = (bullet.length || 72) / 2;
  const halfThickness = (bullet.thickness || 10) / 2;
  return Math.abs(localX) <= halfLength + 22 && Math.abs(localY) <= halfThickness + 20;
}

function updateEnemyBullets() {
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.age += 1;
    bullet.life -= 1;

    if (bullet.turnRate > 0) {
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const dx = state.player.x - bullet.x;
      const dy = state.player.y - bullet.y;
      const length = Math.hypot(dx, dy) || 1;
      const targetVx = (dx / length) * speed;
      const targetVy = (dy / length) * speed;
      bullet.vx = lerp(bullet.vx, targetVx, bullet.turnRate);
      bullet.vy = lerp(bullet.vy, targetVy, bullet.turnRate);
    }

    if (bullet.kind === "mine") {
      bullet.vy += Math.sin(bullet.age * 0.08 + bullet.phase) * 0.03;
    } else if (bullet.kind === "meteor") {
      bullet.vy += 0.02;
    }

    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    if (bullet.bounceY && bullet.bouncesRemaining > 0) {
      const wallPadding = Math.max(10, (bullet.thickness || bullet.radius) / 2);
      const hitTopWall = bullet.y <= wallPadding && bullet.vy < 0;
      const hitBottomWall = bullet.y >= canvas.height - wallPadding && bullet.vy > 0;
      if (hitTopWall || hitBottomWall) {
        bullet.y = hitTopWall ? wallPadding : canvas.height - wallPadding;
        bullet.vy *= -1;
        bullet.bouncesRemaining -= 1;
        addEffect(bullet.x, bullet.y, bullet.color, 12, 4);
      }
    }

    const radius = bullet.radius + Math.sin(bullet.age * 0.12 + bullet.phase) * (bullet.pulse ?? 0);
    const hitPlayerShip = bullet.kind === "laser"
      ? enemyLaserHitsPlayer(bullet)
      : Math.hypot(bullet.x - state.player.x, bullet.y - state.player.y) < Math.max(8, radius) + 22;
    if (hitPlayerShip) {
      hitPlayer(bullet.damage);
      return false;
    }

    return bullet.life > 0 && bullet.x > -120 && bullet.x < canvas.width + 140 && bullet.y > -120 && bullet.y < canvas.height + 120;
  });
}

function updatePickups() {
  state.pickups = state.pickups.filter((pickup) => {
    pickup.age += 1;
    pickup.x += pickup.vx;
    pickup.y += Math.sin((state.frame + pickup.age) * 0.08) * 0.9;

    if (Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) < 42) {
      applyPickup(pickup.kind);
      addEffect(pickup.x, pickup.y, "rgba(151, 242, 222, 0.55)", 18, 10);
      return false;
    }

    return pickup.x > -40;
  });
}

function updateEffects() {
  state.effects = state.effects.filter((effect) => {
    effect.x += effect.vx;
    effect.y += effect.vy;
    effect.life -= 1;
    effect.size *= 0.985;
    return effect.life > 0;
  });
}

function updateStars() {
  state.stars.forEach((star) => {
    star.x -= star.speed * star.layer;
    if (star.x < -6) {
      star.x = canvas.width + Math.random() * 80;
      star.y = Math.random() * canvas.height;
    }
  });
}

function advanceCampaignIfNeeded() {
  if (state.pendingBossSpawn && !state.boss && state.stageState === "wave" && state.stageTransition <= 0) {
    state.pendingBossSpawn = false;
    spawnBoss();
  }

  if (state.stageTransition <= 0) {
    return;
  }

  state.stageTransition -= 1;
  if (state.stageTransition === 0) {
    beginStage(state.stageNumber + 1);
  }
}

function update() {
  state.frame += 1;
  state.cameraShake *= 0.88;

  if (state.messageTimer > 0 && state.messageTimer < 999999) {
    state.messageTimer -= 1;
  }
  if (state.stageIntroTimer > 0) {
    state.stageIntroTimer -= 1;
  }

  updateStars();
  updatePlayer();
  updateBullets();
  updateEnemies();
  updateBoss();
  updateEnemyBullets();
  updatePickups();
  updateEffects();
  advanceCampaignIfNeeded();
  syncHud();
}

function drawBackground() {
  const hue = (state.stageNumber * 17) % 360;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#07101d");
  gradient.addColorStop(0.5, `hsl(${(hue + 210) % 360} 45% 12%)`);
  gradient.addColorStop(1, "#05070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(canvas.width * 0.18, canvas.height * 0.32, 10, canvas.width * 0.18, canvas.height * 0.32, 360);
  glow.addColorStop(0, `hsla(${hue} 80% 58% / 0.22)`);
  glow.addColorStop(1, `hsla(${hue} 80% 58% / 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.stars.forEach((star) => {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.22 + star.layer * 0.38})`;
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = `hsla(${hue} 90% 70% / 0.08)`;
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawSprite(image, x, y, width, height, options = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (options.flipX) {
    ctx.scale(-1, 1);
  }
  ctx.globalAlpha = options.alpha ?? 1;
  if (options.glow) {
    ctx.shadowBlur = options.glow.blur;
    ctx.shadowColor = options.glow.color;
  }

  if (image) {
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.fillStyle = options.fallbackColor ?? "#8fe6ff";
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(-width / 6, -height / 2);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(-width / 6, height / 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayer() {
  if (state.player.invulnerability > 0 && Math.floor(state.player.invulnerability / 5) % 2 === 0) {
    return;
  }

  drawSprite(state.images.player, state.player.x, state.player.y, state.player.width, state.player.height, {
    glow: { blur: 24, color: "rgba(95, 234, 255, 0.38)" },
    fallbackColor: "#6cd9ff"
  });

  getWingmanOffsets().forEach((offset) => {
    drawSprite(state.images.player, state.player.x + offset.x, state.player.y + offset.y, 68, 34, {
      glow: { blur: 18, color: "rgba(82, 251, 204, 0.28)" },
      alpha: 0.92,
      fallbackColor: "#7dfbd5"
    });
  });

  if (state.player.shield > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(147, 223, 255, 0.65)";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(147, 223, 255, 0.4)";
    ctx.beginPath();
    ctx.ellipse(state.player.x, state.player.y, 54, 38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    const color = enemy.type === "frigate" || enemy.type === "carrier"
      ? "rgba(255, 157, 114, 0.26)"
      : enemy.type === "interceptor"
        ? "rgba(255, 98, 150, 0.24)"
        : "rgba(255, 88, 88, 0.24)";

    drawSprite(state.images.enemy, enemy.x, enemy.y, enemy.width, enemy.height, {
      glow: { blur: 18, color },
      fallbackColor: "#ff6e66"
    });

    if (enemy.type === "frigate" || enemy.type === "carrier") {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 145, 97, 0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(enemy.x - 44, enemy.y - enemy.height / 2 - 10, 88, 6);
      ctx.fillStyle = "rgba(255, 145, 97, 0.8)";
      ctx.fillRect(enemy.x - 44, enemy.y - enemy.height / 2 - 10, 88 * (enemy.hp / enemy.maxHp), 6);
      ctx.restore();
    }
  });
}

function drawBossDecorations(boss) {
  const crownCount = 2 + (boss.wingIndex % 5);
  const podCount = 2 + (boss.podIndex % 5);
  const ribCount = 3 + (boss.armorIndex % 6);
  const coreCount = 1 + (boss.coreIndex % 4);
  const wingSpread = 0.22 + boss.wingIndex * 0.025;
  const hullOffset = (boss.hullIndex - 4.5) * 4;

  ctx.save();
  ctx.translate(boss.x, boss.y);

  for (let index = 0; index < crownCount; index += 1) {
    const angle = -0.95 + (1.9 * index) / Math.max(1, crownCount - 1);
    const length = boss.width * (wingSpread + (index % 2) * 0.045);
    const baseX = -boss.width * (0.1 + (boss.hullIndex % 3) * 0.035);
    const baseY = hullOffset + Math.sin(index + boss.visualIndex) * 8;
    ctx.strokeStyle = boss.accent;
    ctx.lineWidth = 3 + (boss.wingIndex % 3);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(
      Math.cos(angle) * length - boss.width * (0.16 + boss.hullIndex * 0.006),
      Math.sin(angle) * length * (0.48 + boss.wingIndex * 0.012)
    );
    ctx.stroke();
  }

  for (let index = 0; index < ribCount; index += 1) {
    const ratio = (index + 1) / (ribCount + 1);
    const x = -boss.width * 0.38 + boss.width * 0.55 * ratio;
    const y = Math.sin(index * 1.7 + boss.visualIndex) * boss.height * 0.18;
    const ribHeight = boss.height * (0.18 + ((index + boss.hullIndex) % 3) * 0.06);
    ctx.strokeStyle = `hsla(${(boss.hue + 38) % 360} 90% 70% / 0.56)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - ribHeight);
    ctx.lineTo(x + boss.width * 0.08, y + ribHeight);
    ctx.stroke();
  }

  for (let index = 0; index < podCount; index += 1) {
    const offsetY = ((index + 1) / (podCount + 1) - 0.5) * boss.height * 0.9;
    const offsetX = -boss.width * (0.2 + ((index + boss.podIndex) % 3) * 0.06);
    const podRadius = 9 + ((index + boss.podIndex) % 4) * 3;
    ctx.fillStyle = boss.accentGlow;
    ctx.beginPath();
    ctx.arc(offsetX, offsetY, podRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = boss.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (let index = 0; index < coreCount; index += 1) {
    const angle = (Math.PI * 2 * index) / coreCount + boss.coreIndex * 0.21;
    const radiusX = boss.width * (0.08 + (boss.coreIndex % 3) * 0.025);
    const radiusY = boss.height * (0.08 + (boss.hullIndex % 3) * 0.03);
    const coreX = -boss.width * 0.12 + Math.cos(angle) * radiusX;
    const coreY = Math.sin(angle) * radiusY;
    ctx.fillStyle = `hsla(${(boss.hue + 55) % 360} 100% 66% / 0.78)`;
    ctx.shadowBlur = 22;
    ctx.shadowColor = boss.accent;
    ctx.beginPath();
    ctx.arc(coreX, coreY, 13 + (boss.coreIndex % 5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBoss() {
  if (!state.boss) {
    return;
  }

  const boss = state.boss;
  const stretchX = 1 + (boss.hullIndex - 4.5) * 0.018;
  const stretchY = 1 + (boss.wingIndex - 4.5) * 0.012;
  const tilt = Math.sin(boss.age * 0.012 + boss.visualIndex) * (0.012 + boss.movementIndex * 0.001);

  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(tilt);
  ctx.scale(stretchX, stretchY);
  drawSprite(state.images.boss, 0, 0, boss.width, boss.height, {
    glow: { blur: 34, color: boss.accentGlow },
    fallbackColor: "#ff8868"
  });
  ctx.restore();

  drawBossDecorations(boss);

  if (boss.hullIndex % 3 === 0) {
    drawSprite(state.images.boss, boss.x + boss.width * 0.1, boss.y - boss.height * 0.24, boss.width * 0.38, boss.height * 0.22, {
      glow: { blur: 18, color: boss.accentGlow },
      alpha: 0.68,
      fallbackColor: "#ff8868"
    });
  }

  if (boss.hullIndex % 3 === 1) {
    drawSprite(state.images.boss, boss.x - boss.width * 0.04, boss.y + boss.height * 0.28, boss.width * 0.42, boss.height * 0.24, {
      glow: { blur: 18, color: boss.accentGlow },
      alpha: 0.62,
      fallbackColor: "#ff8868"
    });
  }

  if (boss.hullIndex % 3 === 2) {
    drawSprite(state.images.boss, boss.x - boss.width * 0.26, boss.y, boss.width * 0.24, boss.height * 0.68, {
      glow: { blur: 18, color: boss.accentGlow },
      alpha: 0.58,
      fallbackColor: "#ff8868"
    });
  }

  ctx.save();
  ctx.fillStyle = "rgba(4, 10, 16, 0.82)";
  ctx.fillRect(24, 26, canvas.width - 48, 18);
  ctx.fillStyle = boss.accent;
  ctx.fillRect(24, 26, (canvas.width - 48) * (boss.hp / boss.maxHp), 18);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.strokeRect(24, 26, canvas.width - 48, 18);
  ctx.font = '700 19px "Orbitron", sans-serif';
  ctx.fillStyle = "#f6e5da";
  ctx.fillText(`STAGE ${boss.stage} | ${boss.name}`, 28, 22);
  ctx.font = '700 13px "Orbitron", sans-serif';
  ctx.fillStyle = "rgba(255, 235, 226, 0.8)";
  ctx.fillText(boss.threatLabel, 28, 64);
  ctx.restore();

  if (boss.beamCharge > 0) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 124, 88, 0.18)";
    ctx.fillRect(0, boss.y - 30, boss.x - 120, 60);
    ctx.restore();
  }

  if (boss.beamActive > 0) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 132, 91, 0.26)";
    ctx.fillRect(0, boss.beamY - 28, boss.x - 120, 56);
    ctx.shadowBlur = 28;
    ctx.shadowColor = boss.accentGlow;
    ctx.fillStyle = boss.accent;
    ctx.fillRect(0, boss.beamY - 12, boss.x - 120, 24);
    ctx.restore();
  }
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    ctx.save();
    ctx.fillStyle = bullet.color;
    ctx.shadowBlur = bullet.type === "laser" ? 18 : 10;
    ctx.shadowColor = bullet.color;
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    ctx.restore();
  });

  state.enemyBullets.forEach((bullet) => {
    const radius = bullet.radius + Math.sin(bullet.age * 0.12 + bullet.phase) * (bullet.pulse ?? 0);
    ctx.save();
    ctx.fillStyle = bullet.color;
    ctx.shadowBlur = bullet.kind === "laser" ? 24 : 14;
    ctx.shadowColor = bullet.trailHue === null ? bullet.color : `hsla(${bullet.trailHue} 90% 65% / 0.65)`;
    if (bullet.kind === "laser") {
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
      ctx.fillRect(-bullet.length / 2, -bullet.thickness / 2, bullet.length, bullet.thickness);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(-bullet.length / 2, -Math.max(2, bullet.thickness * 0.18), bullet.length, Math.max(4, bullet.thickness * 0.36));
    } else {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(4, radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawPickups() {
  const colors = {
    speed: ["#79eaff", "#b9fcff"],
    wingman: ["#67ffb4", "#d5ffe9"],
    laser: ["#ff8b5d", "#ffd78c"],
    shield: ["#97b8ff", "#f0f7ff"]
  };
  const labels = {
    speed: "1",
    wingman: "2",
    laser: "3",
    shield: "4"
  };

  state.pickups.forEach((pickup) => {
    const [inner, outer] = colors[pickup.kind];
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = inner;
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#041018";
    ctx.font = '700 14px "Orbitron", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[pickup.kind], 0, 1);
    ctx.restore();
  });
}

function drawEffects() {
  state.effects.forEach((effect) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, effect.life / 48);
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawCenterPanel(title, message) {
  ctx.save();
  ctx.fillStyle = "rgba(2, 8, 16, 0.72)";
  ctx.fillRect(canvas.width / 2 - 320, canvas.height / 2 - 110, 640, 220);
  ctx.strokeStyle = "rgba(123, 227, 255, 0.28)";
  ctx.strokeRect(canvas.width / 2 - 320, canvas.height / 2 - 110, 640, 220);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f3fdff";
  ctx.font = '800 38px "Orbitron", sans-serif';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 18);
  ctx.fillStyle = "rgba(232, 251, 255, 0.82)";
  ctx.font = '700 22px "Rajdhani", sans-serif';
  wrapText(message, canvas.width / 2, canvas.height / 2 + 28, 540, 28);
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let offsetY = 0;

  for (const word of words) {
    const testLine = `${line}${word} `;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y + offsetY);
      line = `${word} `;
      offsetY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line.trim(), x, y + offsetY);
  }
}

function drawRunningBanner() {
  if (state.stageTransition > 0) {
    const nextBoss = getBossProfile(state.stageNumber + 1).name;
    drawCenterPanel(
      `STAGE ${state.stageNumber} CLEAR`,
      `Hyper jump 中。次は Stage ${state.stageNumber + 1} と ${nextBoss} です。`
    );
  } else if (state.stageIntroTimer > 0) {
    drawCenterPanel(
      `STAGE ${state.stageNumber}`,
      `${state.previewBossName} を撃破して次の面へ進みましょう。`
    );
  }
}

function drawOverlay() {
  if (state.mode === "ready") {
    drawCenterPanel("ASTRA RAIDERS", "Start Mission で出撃。100 面と 100 種のボスを突破してください。");
  } else if (state.mode === "paused") {
    drawCenterPanel("PAUSED", `Stage ${state.stageNumber} を一時停止中です。`);
  } else if (state.mode === "gameover") {
    drawCenterPanel("MISSION FAILED", "Restart で Stage 1 から再挑戦できます。");
  } else if (state.mode === "victory") {
    drawCenterPanel(
      "CAMPAIGN COMPLETE",
      `Stage 100 まで制圧しました。最終スコア ${state.score.toLocaleString("ja-JP")}。`
    );
  } else if (state.mode === "running" && (state.stageTransition > 0 || state.stageIntroTimer > 0)) {
    drawRunningBanner();
  }
}

function render() {
  ctx.save();
  const shakeX = (Math.random() - 0.5) * state.cameraShake;
  const shakeY = (Math.random() - 0.5) * state.cameraShake;
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawPickups();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawPlayer();
  drawEffects();
  drawOverlay();

  ctx.restore();
}

function loop() {
  if (state.mode === "running") {
    update();
  }
  render();
  requestAnimationFrame(loop);
}

function eventToCanvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  unlockAudio();
  keys.add(event.code);

  if ((event.code === "Space" || event.code === "Enter") && state.mode === "ready") {
    startGame();
  } else if (event.code === "KeyP") {
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  const pos = eventToCanvasPosition(event);
  unlockAudio();
  pointer.active = true;
  pointer.x = pos.x;
  pointer.y = pos.y;

  if (state.mode === "ready") {
    startGame();
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active) {
    return;
  }
  const pos = eventToCanvasPosition(event);
  pointer.x = pos.x;
  pointer.y = pos.y;
});

window.addEventListener("pointerup", () => {
  pointer.active = false;
});

ui.startButton.addEventListener("click", () => {
  if (state.mode !== "running") {
    startGame();
  }
});

ui.pauseButton.addEventListener("click", () => {
  if (state.mode === "running" || state.mode === "paused") {
    togglePause();
  }
});

ui.restartButton.addEventListener("click", () => {
  startGame();
});

ui.musicToggle.addEventListener("click", () => {
  unlockAudio();
  audioState.musicEnabled = !audioState.musicEnabled;
  syncAudioButtons();
  if (audioState.musicEnabled && state.mode === "running") {
    playBgm();
  } else {
    pauseBgm();
  }
});

ui.sfxToggle.addEventListener("click", () => {
  unlockAudio();
  audioState.sfxEnabled = !audioState.sfxEnabled;
  syncAudioButtons();
});

ui.refreshRankingButton.addEventListener("click", () => {
  loadLeaderboard();
});

ui.scoreForm.addEventListener("submit", submitScore);

async function boot() {
  await loadAssets();
  setupAudio();
  resetGame();

  try {
    ui.playerNameInput.value = localStorage.getItem("astraPlayerName") ?? "";
  } catch {
    ui.playerNameInput.value = "";
  }

  loadLeaderboard();
  render();
  loop();
}

boot();
