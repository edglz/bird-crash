// Bird Crash: fan clone of Angry Birds. Physics with Matter.js, drawing with 2D canvas.
// Shapes are drawn in code until sprites exist (see README.md).
const { Engine, Bodies, Body, World, Events, Composite, Vector } = Matter;

const W = 960;
const H = 540;
const GROUND_Y = 500;
const ANCHOR = { x: 172, y: 372 };   // bird rest position: between the slingshot tips
const MAX_PULL = 90;                 // max pull in px
const LAUNCH_K = 0.22;               // px/step of speed per px of pull (0.16 doesn't reach level 1)
const STEP = 1000 / 60;              // fixed physics step (60 Hz)
const SPLIT_ANGLE = 0.35;            // rad: fan angle of the blue bird
const EXPLODE_R = 110;               // black bird explosion radius

const BIRDS = {
  red:    { r: 16, color: '#e53935', density: 0.002 },
  yellow: { r: 14, color: '#fdd835', density: 0.002 },
  blue:   { r: 12, color: '#1e88e5', density: 0.002 },
  black:  { r: 16, color: '#263238', density: 0.003 },
};
// hp: accumulated damage it can take; thr: impulse (reduced mass * relative speed) below which there is no damage
// hp: HP of each block (values from the AngryBirdsRemakeUnity repo: wood 100, stone 200, glass 50)
const MATS = {
  wood:  { color: '#a1673a', hp: 100 },
  stone: { color: '#9e9e9e', hp: 200 },
  glass: { color: '#b3e5fc', hp: 50 },
};
// Pig types: each uses a row of assets/pigs. Rows go from healthy to damaged.
// Repo HP: medium 75, large 125, helmet 200. The king doesn't die from one bird hit (wiki).
const PIG_TYPES = {
  medium: { r: 16, hp: 75, n: 9 },
  helmet: { r: 18, hp: 200, n: 8 },
  large: { r: 22, hp: 125, n: 9 },
  king: { r: 26, hp: 200, n: 10 },
};
const PIG_COLOR = '#7cb342';

const LEVELS = [
  {
    birds: ['red', 'blue', 'yellow'],
    blocks: [
      { m: 'wood', x: 660, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 740, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 700, y: 412, w: 110, h: 14 },
      { m: 'stone', x: 820, y: 465, w: 20, h: 70 },
      { m: 'stone', x: 900, y: 465, w: 20, h: 70 },
      { m: 'glass', x: 860, y: 425, w: 110, h: 10 },
    ],
    pigs: [{ x: 700, y: 484, t: 'medium' }, { x: 860, y: 402, t: 'helmet' }],
  },
  {
    birds: ['red', 'blue', 'yellow', 'black'],
    blocks: [
      { m: 'wood', x: 560, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 630, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 595, y: 412, w: 100, h: 14 },
      { m: 'stone', x: 780, y: 480, w: 110, h: 40 },
      { m: 'stone', x: 850, y: 460, w: 20, h: 80 },
      { m: 'stone', x: 930, y: 460, w: 20, h: 80 },
      { m: 'glass', x: 890, y: 415, w: 110, h: 10 },
    ],
    pigs: [{ x: 595, y: 484, t: 'medium' }, { x: 780, y: 442, t: 'helmet' }, { x: 890, y: 480, t: 'large' }],
  },
  // Levels 3 and 4: own designs in the same style (not from the original game).
  {
    birds: ['red', 'blue', 'yellow', 'black', 'red'],
    blocks: [
      { m: 'wood', x: 520, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 600, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 560, y: 412, w: 110, h: 14 },
      { m: 'stone', x: 700, y: 460, w: 20, h: 80 },
      { m: 'stone', x: 780, y: 460, w: 20, h: 80 },
      { m: 'stone', x: 740, y: 414, w: 110, h: 12 },
      { m: 'glass', x: 860, y: 460, w: 16, h: 80 },
      { m: 'glass', x: 930, y: 460, w: 16, h: 80 },
      { m: 'glass', x: 895, y: 412, w: 100, h: 10 },
    ],
    pigs: [{ x: 560, y: 484, t: 'medium' }, { x: 740, y: 394, t: 'helmet' }, { x: 895, y: 380, t: 'large' }],
  },
  {
    birds: ['red', 'blue', 'yellow', 'black', 'red', 'blue'],
    blocks: [
      { m: 'wood', x: 520, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 600, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 560, y: 412, w: 100, h: 14 },
      { m: 'stone', x: 760, y: 480, w: 130, h: 40 },
      { m: 'stone', x: 860, y: 460, w: 20, h: 80 },
      { m: 'stone', x: 900, y: 460, w: 20, h: 80 },
      { m: 'glass', x: 880, y: 412, w: 80, h: 10 },
    ],
    pigs: [{ x: 560, y: 484, t: 'medium' }, { x: 760, y: 440, t: 'helmet' }, { x: 880, y: 378, t: 'king' }],
  },
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Physical canvas resolution (sharp on retina screens); drawing uses 960×540 coordinates.
const DPR = Math.min(window.devicePixelRatio || 1, 3);
canvas.width = Math.round(W * DPR);
canvas.height = Math.round(H * DPR);
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

const PROGRESS_KEY = 'bird-crash-progress';
let progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]');
let particles = [];
let lastHit = 0;

function burst(p, color, n = 10, speed = 4) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: p.x, y: p.y,
      vx: (Math.random() * 2 - 1) * speed,
      vy: (Math.random() * 2 - 1) * speed - 2,
      life: 1, color, r: 2 + Math.random() * 3,
    });
  }
}

function drawParticles() {
  particles = particles.filter(q => q.life > 0);
  for (const q of particles) {
    q.vy += 0.25;
    q.x += q.vx;
    q.y += q.vy;
    q.life -= 0.03;
    ctx.globalAlpha = Math.max(q.life, 0);
    ctx.fillStyle = q.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Frames per type, taken from the sheet (assets/birds). Cycled as an animation.
// chuck_05 is Chuck's motion-blur frame: used when boosting.
const FRAMES = {
  red: ['red_01', 'red_02', 'red_03', 'red_04', 'red_05'],
  blue: ['blue_01', 'blue_02', 'blue_03', 'blue_04'],
  yellow: ['chuck_01', 'chuck_02', 'chuck_03', 'chuck_04', 'chuck_06'],
  black: ['bomb_01', 'bomb_02', 'bomb_03', 'bomb_04'],
};
const DASH_FRAME = 'chuck_05';
// Block textures: crops of assets/sheets/blocks-common.png, repeated as a pattern.
const TEX_CROPS = { wood: [320, 612, 180, 28], stone: [320, 700, 180, 22], glass: [320, 654, 180, 22] };
const patterns = {};
const blocksSheet = new Image();
blocksSheet.src = 'assets/sheets/blocks-common.png';
blocksSheet.onload = () => {
  for (const mat in TEX_CROPS) {
    const [x, y, w, h] = TEX_CROPS[mat];
    const tile = document.createElement('canvas');
    tile.width = w;
    tile.height = h;
    tile.getContext('2d').drawImage(blocksSheet, x, y, w, h, 0, 0, w, h);
    patterns[mat] = ctx.createPattern(tile, 'repeat');
  }
};

// Pigs: 9 damage stages (medium_01 healthy → medium_09 heavily damaged), from assets/pigs.
const pigFrames = (type) => Array.from({ length: PIG_TYPES[type].n }, (_, i) => `pigs/${type}_${String(i + 1).padStart(2, '0')}`);
const PIG_NAMES = Object.keys(PIG_TYPES).flatMap(pigFrames);
const sprites = {};
for (const name of [...Object.values(FRAMES).flat(), DASH_FRAME, ...PIG_NAMES]) {
  sprites[name] = new Image();
  sprites[name].src = name.startsWith('pigs/') ? `assets/${name}.png` : `assets/birds/${name}.png`;
}

let engine, queue, flying, dead, levelIndex = 0, score = 0;
let state = 'menu';
let dragging = false, drag = { x: 0, y: 0 };
let acc = 0, last = performance.now();

// ---------- world construction ----------

function makeBird(type, x, y) {
  const b = Bodies.circle(x, y, BIRDS[type].r, {
    density: BIRDS[type].density, restitution: 0.3, friction: 0.5, frictionAir: 0,
  });
  b.game = { kind: 'bird', type, age: 0, used: false };
  return b;
}

function makeBlock(d) {
  const b = Bodies.rectangle(d.x, d.y, d.w, d.h, { friction: 0.6, restitution: 0.1 });
  b.game = { kind: 'block', mat: d.m, hp: MATS[d.m].hp, thr: MATS[d.m].thr };
  return b;
}

function makePig(d) {
  const t = d.t || 'medium';
  const b = Bodies.circle(d.x, d.y, PIG_TYPES[t].r, { friction: 0.5, restitution: 0.1 });
  b.game = { kind: 'pig', t, hp: PIG_TYPES[t].hp, maxhp: PIG_TYPES[t].hp, thr: PIG_TYPES[t].thr };
  return b;
}

function makeGround() {
  const g = Bodies.rectangle(W / 2, GROUND_Y + 30, W * 2, 60, { isStatic: true });
  g.game = { kind: 'ground' };
  return g;
}

function buildWorld(level) {
  engine = Engine.create();
  dead = new Set();
  flying = [];
  queue = [...level.birds];
  const walls = Bodies.rectangle(-20, H / 2, 40, H * 2, { isStatic: true });
  walls.game = { kind: 'ground' };
  World.add(engine.world, [makeGround(), walls, ...level.blocks.map(makeBlock), ...level.pigs.map(makePig)]);
  Events.on(engine, 'collisionStart', onCollide);
}

// ---------- damage ----------

// Approximate impulse: reduced mass * relative speed at contact (not Box2D's exact impulse).
// Rules taken from AngryBirdsRemakeUnity (MIT, JdomiDev/AngryBirdsRemakeUnity):
// - pig: damage = relative speed × 8; a bird kills it in one hit (not the king, per the wiki).
// - block: damage = relative speed × 5; bird hits deal double.
function onCollide(ev) {
  for (const { bodyA: a, bodyB: b } of ev.pairs) {
    const rel = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
    damage(a, b, rel);
    damage(b, a, rel);
    const now = performance.now();
    if (rel > 4 && now - lastHit > 80) {
      lastHit = now;
      Sound.sfx.hit(rel);
    }
    // the black bird explodes on landing
    for (const bird of [a, b]) {
      if (bird.game && bird.game.kind === 'bird' && bird.game.type === 'black' && !bird.game.used && bird.game.age > 150) {
        explode(bird);
      }
    }
  }
}

function damage(target, other, rel) {
  const g = target.game;
  if (!g || g.hp === undefined) return;
  const fromBird = other.game && other.game.kind === 'bird';
  let d;
  if (g.kind === 'pig') {
    if (fromBird && g.t !== 'king') { g.hp = 0; dead.add(target); return; }
    d = rel * 8;
  } else if (g.kind === 'block') {
    d = rel * 5 * (fromBird ? 2 : 1);
  } else {
    return;
  }
  g.hp -= d;
  if (g.hp <= 0) dead.add(target);
}

function processDead() {
  for (const b of dead) {
    if (b.game.gone) continue;
    b.game.gone = true;
    if (b.game.kind === 'pig') {
      score += 5000;
      burst(b.position, PIG_COLOR, 14);
      Sound.sfx.pig();
    } else if (b.game.kind === 'block') {
      score += 500;
      burst(b.position, MATS[b.game.mat].color, 8, 3);
      Sound.sfx.block();
    }
    World.remove(engine.world, b);
    flying = flying.filter(f => f !== b);
  }
  dead.clear();
}

// ---------- abilities (tap during flight) ----------

function useAbility(b) {
  b.game.used = true;
  const type = b.game.type;
  if (type === 'yellow') {
    const v = b.velocity;
    Body.setVelocity(b, { x: v.x * 1.8, y: v.y * 1.8 });
    Sound.sfx.boost();
  } else if (type === 'blue') {
    Sound.sfx.split();
    for (const sign of [-1, 1]) {
      const c = makeBird('blue', b.position.x, b.position.y);
      c.game.used = true;
      Body.setVelocity(c, Vector.rotate(b.velocity, sign * SPLIT_ANGLE));
      World.add(engine.world, c);
      flying.push(c);
    }
  } else if (type === 'black') {
    explode(b);
  }
}

function explode(b) {
  burst(b.position, '#ff9800', 24, 7);
  Sound.sfx.explode();
  for (const o of Composite.allBodies(engine.world)) {
    if (o === b || o.isStatic) continue;
    const dx = o.position.x - b.position.x, dy = o.position.y - b.position.y;
    const d = Math.hypot(dx, dy);
    if (d > EXPLODE_R) continue;
    const k = 1 - d / EXPLODE_R, n = d || 1;
    Body.setVelocity(o, { x: o.velocity.x + (dx / n) * k * 12, y: o.velocity.y + (dy / n) * k * 12 });
    if (o.game && o.game.hp !== undefined) {
      o.game.hp -= 30 * k;
      if (o.game.hp <= 0) dead.add(o);
    }
  }
  dead.add(b);
}

// ---------- launch and trajectory ----------

function launchVel(d) {
  return { x: -d.x * LAUNCH_K, y: -d.y * LAUNCH_K };
}

function clampDrag(p) {
  let v = { x: p.x - ANCHOR.x, y: p.y - ANCHOR.y };
  const m = Vector.magnitude(v);
  if (m > MAX_PULL) v = Vector.mult(Vector.normalise(v), MAX_PULL);
  // keep the band from going into the ground
  if (ANCHOR.y + v.y > GROUND_Y - 20) v.y = GROUND_Y - 20 - ANCHOR.y;
  return v;
}

// Simulates the flight with the same engine and the same mass as the real bird.
function predict(d) {
  const e = Engine.create();
  const b = makeBird(queue[0], ANCHOR.x + d.x, ANCHOR.y + d.y);
  Body.setVelocity(b, launchVel(d));
  World.add(e.world, [makeGround(), b]);
  const pts = [];
  for (let i = 0; i < 300; i++) {
    Engine.update(e, STEP);
    if (i % 4 === 0) pts.push({ x: b.position.x, y: b.position.y });
    if (b.position.y > GROUND_Y - BIRDS[queue[0]].r || b.position.x > W) break;
  }
  return pts;
}

function launch() {
  Sound.sfx.launch();
  const type = queue.shift();
  const b = makeBird(type, ANCHOR.x + drag.x, ANCHOR.y + drag.y);
  World.add(engine.world, b);
  Body.setVelocity(b, launchVel(drag));
  flying.push(b);
  drag = { x: 0, y: 0 };
}

// ---------- turn cycle and end ----------

function pigs() {
  return Composite.allBodies(engine.world).filter(b => b.game && b.game.kind === 'pig');
}

function updateFlying() {
  for (const b of flying) {
    b.game.age += STEP;
    const sp = Vector.magnitude(b.velocity);
    const off = b.position.x > W + 100 || b.position.x < -100 || b.position.y > H + 100;
    if (off || (b.game.age > 1000 && sp < 0.3) || b.game.age > 10000) dead.add(b);
  }
}

function checkEnd() {
  if (pigs().length === 0) return finish(true);
  if (!flying.length && !queue.length) finish(false);
}

// Stars: 1 for any win, 2 and 3 by score (own thresholds).
const STAR_THRESHOLDS = [5000, 12000];

function finish(won) {
  state = won ? 'won' : 'lost';
  const stars = won ? 1 + STAR_THRESHOLDS.filter(t => score >= t).length : 0;
  if (won) {
    progress[levelIndex] = Math.max(progress[levelIndex] || 0, stars);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }
  Sound.stopMusic();
  Sound.sfx[won ? 'win' : 'lose']();
  document.getElementById('end-title').textContent = won ? 'Level cleared!' : 'Out of birds';
  document.getElementById('end-score').textContent = `Score: ${score}`;
  for (const [i, el] of document.querySelectorAll('#stars img').entries()) el.classList.toggle('on', i < stars);
  document.getElementById('next').hidden = !won || levelIndex + 1 >= LEVELS.length;
  showOverlay('end');
}

// Menu: cards stay locked until the previous level is beaten; saved stars.
function renderMenu() {
  for (const card of document.querySelectorAll('.card')) {
    const i = Number(card.dataset.level);
    const unlocked = i === 0 || (progress[i - 1] || 0) > 0;
    card.classList.toggle('locked', !unlocked);
    card.disabled = !unlocked;
    const stars = progress[i] || 0;
    for (const [k, img] of card.querySelectorAll('.stars img').entries()) img.classList.toggle('on', k < stars);
  }
}

function stepWorld() {
  Engine.update(engine, STEP);
  updateFlying();
  processDead();
  checkEnd();
}

// ---------- render ----------

function drawBody(body) {
  const g = body.game;
  if (g.kind === 'pig') {
    drawPig(body.position, body.angle, g);
  } else if (g.kind === 'block') {
    ctx.beginPath();
    body.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
    ctx.closePath();
    ctx.fillStyle = patterns[g.mat] || MATS[g.mat].color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.stroke();
  } else if (g.kind === 'bird') {
    drawBird(body.position, body.angle, g.type, g.used);
  }
}

// Damage stage based on remaining HP (full hp = frame 1).
function drawPig(p, angle, g) {
  const frames = pigFrames(g.t);
  const stage = Math.min(frames.length - 1, Math.floor((1 - Math.max(g.hp, 0) / g.maxhp) * frames.length));
  const img = sprites[frames[stage]];
  const r = PIG_TYPES[g.t].r;
  if (!img.complete || !img.naturalWidth) {
    circle(p, r, PIG_COLOR);
    eyes(p, r);
    return;
  }
  const w = r * 2.4, h = (w * img.naturalHeight) / img.naturalWidth;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawBird(p, angle, type, used = false) {
  const r = BIRDS[type].r;
  const names = FRAMES[type];
  // Not cycled: the sheet's poses are one-off gestures, and alternating them looks like flicker.
  const name = type === 'yellow' && used ? DASH_FRAME : names[0];
  const img = sprites[name];
  const ref = sprites[names[0]];
  if (!img.complete || !img.naturalWidth || !ref.complete || !ref.naturalWidth) {
    circle(p, r, BIRDS[type].color);
    eyes(p, r);
    return;
  }
  // same scale for all frames of the type, based on the first one
  const scale = (r * 2.8) / ref.naturalWidth;
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function circle(p, r, color) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.stroke();
}

function eyes(p, r) {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(p.x - r * 0.3, p.y - r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.arc(p.x + r * 0.3, p.y - r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Background: sky with clouds and hills from assets/sheets/menu-background.png
const bgSheet = new Image();
bgSheet.src = 'assets/sheets/menu-background.png';

function drawBackground() {
  if (bgSheet.complete && bgSheet.naturalWidth) {
    ctx.drawImage(bgSheet, 0, 413, 454, 240, 0, 0, W, GROUND_Y);
    ctx.drawImage(bgSheet, 0, 152, 900, 96, 0, GROUND_Y - 120, W, 120);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#8fd3f4');
    g.addColorStop(1, '#e0f7fa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = '#7cb342';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#558b2f';
  ctx.fillRect(0, GROUND_Y, W, 8);
}

// Slingshot arms: assets/sheets/sling-left.png and sling-right.png (from the bird sheet).
const slingL = new Image();
slingL.src = 'assets/sheets/sling-left.png';
const slingR = new Image();
slingR.src = 'assets/sheets/sling-right.png';
const SLING_H = 120;                 // arm height in px
const TIP_L = { x: ANCHOR.x - 18, y: GROUND_Y - SLING_H };
const TIP_R = { x: ANCHOR.x + 22, y: GROUND_Y - SLING_H };

function drawSling(bx, by) {
  if (slingL.complete && slingR.complete && slingL.naturalWidth && slingR.naturalWidth) {
    const wL = (slingL.naturalWidth * SLING_H) / slingL.naturalHeight;
    const wR = (slingR.naturalWidth * SLING_H) / slingR.naturalHeight;
    ctx.drawImage(slingL, TIP_L.x - wL / 2, GROUND_Y - SLING_H, wL, SLING_H);
    ctx.drawImage(slingR, TIP_R.x - wR / 2, GROUND_Y - SLING_H, wR, SLING_H);
  } else {
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(TIP_L.x, TIP_L.y);
    ctx.lineTo(ANCHOR.x, GROUND_Y);
    ctx.lineTo(TIP_R.x, TIP_R.y);
    ctx.stroke();
  }
  if (dragging) {
    // elastic band: runs from both tips to the bird
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(TIP_L.x, TIP_L.y);
    ctx.lineTo(bx, by);
    ctx.lineTo(TIP_R.x, TIP_R.y);
    ctx.stroke();
  }
}

function drawTrajectory() {
  const pts = predict(drag);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  drawBackground();
  for (const body of Composite.allBodies(engine.world)) {
    if (body.game && body.game.kind !== 'ground') drawBody(body);
  }
  // bird loaded in the slingshot and the bird queue
  const bx = ANCHOR.x + drag.x, by = ANCHOR.y + drag.y;
  if (queue.length && !flying.length) {
    if (dragging && (drag.x || drag.y)) drawTrajectory();
    drawBird({ x: bx, y: by }, 0, queue[0]);
  }
  drawSling(bx, by);
  drawParticles();
  for (let i = 1; i < queue.length; i++) {
    circle({ x: 40 + i * 32, y: GROUND_Y - 18 }, 12, BIRDS[queue[i]].color);
  }
  ctx.fillStyle = '#263238';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Score: ${score}`, W / 2, 34);
}

// ---------- entrada ----------

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}

canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing') return;
  const p = toCanvas(e);
  if (!flying.length && queue.length && Math.hypot(p.x - ANCHOR.x, p.y - ANCHOR.y) < 50) {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    drag = clampDrag(p);
    return;
  }
  const target = flying.filter(f => !f.game.used && f.game.type !== 'red').pop();
  if (target) useAbility(target);
});

canvas.addEventListener('pointermove', e => {
  if (dragging) drag = clampDrag(toCanvas(e));
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (Vector.magnitude(drag) > 8) launch();
  else drag = { x: 0, y: 0 };
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- states and UI ----------

function showOverlay(id) {
  for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('show', o.id === id);
}

function startLevel(i) {
  levelIndex = i;
  score = 0;
  dragging = false;
  drag = { x: 0, y: 0 };
  particles = [];
  buildWorld(LEVELS[i]);
  state = 'playing';
  showOverlay(null);
}

function act(action, level) {
  // music only starts after a click: the browser blocks audio before that
  if (action === 'play') { startLevel(Number(level) || 0); Sound.playMusic(); }
  else if (action === 'restart') { startLevel(levelIndex); Sound.playMusic(); }
  else if (action === 'next') { startLevel(levelIndex + 1); Sound.playMusic(); }
  else if (action === 'pause') { state = 'paused'; showOverlay('pause'); }
  else if (action === 'resume') { state = 'playing'; showOverlay(null); }
  else if (action === 'menu') { state = 'menu'; Sound.stopMusic(); renderMenu(); showOverlay('menu'); }
  else if (action === 'mute') { Sound.toggle(); updateMuteIcon(); }
}

function updateMuteIcon() {
  document.getElementById('mute').classList.toggle('off', Sound.isMuted());
}

for (const btn of document.querySelectorAll('[data-action]')) {
  btn.addEventListener('click', () => act(btn.dataset.action, btn.dataset.level));
}
updateMuteIcon();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state === 'playing') act('pause');
    else if (state === 'paused') act('resume');
  } else if (e.key === 'r' || e.key === 'R') {
    if (state === 'playing' || state === 'paused' || state === 'won' || state === 'lost') act('restart');
  }
});

// ---------- bucle principal (paso fijo) ----------

function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  if (state === 'playing') {
    while (acc >= STEP && state === 'playing') {
      stepWorld();
      acc -= STEP;
    }
  } else {
    acc = 0;
  }
  render();
  requestAnimationFrame(loop);
}

startLevel(0);
state = 'menu';
renderMenu();
showOverlay('menu');
requestAnimationFrame(loop);
