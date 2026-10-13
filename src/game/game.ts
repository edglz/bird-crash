import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Body } from 'planck';
import {
  ANCHOR, BIRDS, GROUND_Y, H, MAX_PULL, PIG_TYPES, POINTS, SLING_H, STAR_THRESHOLDS, STEP, W,
  type BirdType,
} from './config';
import { loadIndex, loadLevel } from './levels';
import { Physics, predict, xPx, yPx, type PhysEvent } from './physics';
import { pigStage, stars } from './rules';
import type { Entity, LevelDef, LevelIndexItem } from './types';
import { sfx, playMusic, stopMusic } from './audio';
import { isUnlocked, loadProgress, saveStars } from './progress';

export type Screen = 'menu' | 'loading' | 'playing' | 'paused' | 'won' | 'lost';
export interface Snapshot {
  screen: Screen;
  levelIndex: number;
  levels: LevelIndexItem[];
  score: number;
  birdsLeft: number;
  stars: number;
  progress: number[];
}
type Listener = (s: Snapshot) => void;

const BASE = '/assets';
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;
const BIRD_FRAMES: Record<BirdType, string[]> = {
  red: ['red_01', 'red_02', 'red_03', 'red_04', 'red_05'],
  blue: ['blue_01', 'blue_02', 'blue_03', 'blue_04'],
  yellow: ['chuck_01', 'chuck_02', 'chuck_03', 'chuck_04', 'chuck_06'],
  black: ['bomb_01', 'bomb_02', 'bomb_03', 'bomb_04'],
  white: ['matilda_01'],
};
const DASH = 'chuck_05';
const SLING_L = 'sling-left', SLING_R = 'sling-right';
const BLOCK_CROPS: Record<'wood' | 'stone' | 'glass', [number, number, number, number]> = {
  wood: [320, 612, 180, 28], stone: [320, 700, 180, 22], glass: [320, 654, 180, 22],
};
const pigFrame = (t: keyof typeof PIG_TYPES, i: number) => `pigs/${t}_${String(i + 1).padStart(2, '0')}`;
const PIG_NAMES = (Object.keys(PIG_TYPES) as Array<keyof typeof PIG_TYPES>)
  .flatMap(t => Array.from({ length: PIG_TYPES[t].frames }, (_, i) => pigFrame(t, i)));
const textureUrls = [...Object.values(BIRD_FRAMES).flat(), DASH, ...PIG_NAMES]
  .map(n => (n.startsWith('pigs/') ? `${BASE}/${n}.png` : `${BASE}/birds/${n}.png`));

export class Game {
  private app!: Application;
  private readonly container: HTMLElement;
  private readonly onWindowUp = () => this.onUp();

  // root is moved and scaled (camera). queueLayer stays fixed on screen.
  private root = new Container();
  private bgLayer = new Container();
  private world = new Container();
  private guide = new Graphics();
  private slingBands = new Graphics();
  private birdAtRest = new Container();
  private fx = new Container();
  private queueLayer = new Container();
  private groundG = new Graphics();
  private sky!: TilingSprite;
  private hills!: TilingSprite;
  private slingBuilt = false;
  private readonly tipL = { x: ANCHOR.x - 18, y: GROUND_Y - SLING_H };
  private readonly tipR = { x: ANCHOR.x + 22, y: GROUND_Y - SLING_H };

  private textures = new Map<string, Texture>();
  private blockTextures = new Map<string, Texture>();
  private views = new Map<Body, Container>();
  private particles: Array<{ g: Graphics; vx: number; vy: number; life: number }> = [];

  private physics: Physics | null = null;
  private levels: LevelIndexItem[] = [];
  private loadToken = 0;
  private screen: Screen = 'menu';
  private levelIndex = 0;
  private score = 0;
  private lastStars = 0;
  private progress: number[] = [];
  private listeners = new Set<Listener>();

  // input and camera (logical screen coordinates 960×540)
  private cam = { x: 0, y: 0, scale: 1 };
  private worldW = W;
  private drag = { x: 0, y: 0 };
  private dragging = false;
  private panning = false;
  private panMoved = 0;
  private panStart = { sx: 0, sy: 0, camX: 0, camY: 0 };
  private userPanned = false;

  private acc = 0;
  private lastHit = 0;

  private constructor(container: HTMLElement) {
    this.container = container;
  }

  static async create(container: HTMLElement): Promise<Game> {
    const g = new Game(container);
    await g.init();
    return g;
  }

  private async init() {
    this.levels = await loadIndex();
    this.progress = loadProgress(this.levels.length);

    this.app = new Application();
    await this.app.init({
      width: W,
      height: H,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      autoDensity: true,
    });
    this.container.appendChild(this.app.canvas);

    const extra = [`${BASE}/sheets/blocks-common.png`, `${BASE}/sheets/menu-background.png`,
      `${BASE}/sheets/sling-left.png`, `${BASE}/sheets/sling-right.png`];
    const loaded = await Assets.load<Texture>([...textureUrls, ...extra]);
    for (const url of textureUrls) {
      this.textures.set(url.replace(`${BASE}/`, '').replace('birds/', '').replace('.png', ''), loaded[url] as Texture);
    }
    this.textures.set(SLING_L, loaded[`${BASE}/sheets/sling-left.png`] as Texture);
    this.textures.set(SLING_R, loaded[`${BASE}/sheets/sling-right.png`] as Texture);
    this.buildScene(loaded[`${BASE}/sheets/menu-background.png`] as Texture, loaded[`${BASE}/sheets/blocks-common.png`] as Texture);

    this.app.stage.addChild(this.root);
    this.app.stage.addChild(this.queueLayer);

    // Direct DOM events on the canvas
    const canvas = this.app.canvas;
    const toLogical = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { sx: ((e.clientX - r.left) * W) / r.width, sy: ((e.clientY - r.top) * H) / r.height };
    };
    canvas.addEventListener('pointerdown', e => { const p = toLogical(e); this.onDown(p.sx, p.sy); });
    canvas.addEventListener('pointermove', e => { const p = toLogical(e); this.onMove(p.sx, p.sy); });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const p = toLogical(e);
      this.zoomAt(p.sx, p.sy, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    window.addEventListener('pointerup', this.onWindowUp);
    this.app.ticker.add(t => this.tick(t.deltaMS / 1000));
  }

  private buildScene(sky: Texture, blocksSheet: Texture) {
    const skyTex = new Texture({ source: sky.source, frame: new Rectangle(0, 413, 454, 240) });
    this.sky = new TilingSprite({ texture: skyTex, width: W, height: GROUND_Y });
    this.sky.tileScale.set(1.2);
    const hillsTex = new Texture({ source: sky.source, frame: new Rectangle(0, 152, 900, 96) });
    this.hills = new TilingSprite({ texture: hillsTex, width: W, height: 120 });
    this.hills.y = GROUND_Y - 120;
    this.bgLayer.addChild(this.sky, this.hills, this.groundG);

    this.root.addChild(this.bgLayer, this.world, this.guide, this.slingBands, this.birdAtRest, this.fx);

    for (const mat of Object.keys(BLOCK_CROPS) as Array<keyof typeof BLOCK_CROPS>) {
      const [x, y, w, h] = BLOCK_CROPS[mat];
      this.blockTextures.set(mat, new Texture({ source: blocksSheet.source, frame: new Rectangle(x, y, w, h) }));
    }
  }

  // ---------- API for the UI ----------

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => { this.listeners.delete(fn); };
  }

  private snapshot(): Snapshot {
    return {
      screen: this.screen,
      levelIndex: this.levelIndex,
      levels: this.levels,
      score: this.score,
      birdsLeft: this.physics ? this.physics.queue.length + this.physics.flying.length : 0,
      stars: this.lastStars,
      progress: this.progress,
    };
  }

  private emitState() {
    const s = this.snapshot();
    for (const fn of this.listeners) fn(s);
  }

  isUnlocked(level: number) {
    return isUnlocked(this.progress, level);
  }

  async startLevel(i: number) {
    const token = ++this.loadToken;
    this.levelIndex = i;
    this.screen = 'loading';
    this.emitState();
    const def = await loadLevel(this.levels[i]);
    if (token !== this.loadToken) return; // another level was requested while loading
    this.score = 0;
    this.lastStars = 0;
    this.dragging = false;
    this.panning = false;
    this.userPanned = false;
    this.drag = { x: 0, y: 0 };
    this.buildLevel(def);
    this.screen = 'playing';
    this.acc = 0;
    playMusic();
    this.emitState();
  }

  pause() {
    if (this.screen === 'playing') { this.screen = 'paused'; this.emitState(); }
  }

  resume() {
    if (this.screen === 'paused') { this.screen = 'playing'; this.emitState(); }
  }

  restart() {
    void this.startLevel(this.levelIndex);
  }

  next() {
    if (this.levelIndex + 1 < this.levels.length) void this.startLevel(this.levelIndex + 1);
  }

  toMenu() {
    this.loadToken++;
    this.screen = 'menu';
    stopMusic();
    this.clearWorld();
    this.emitState();
  }

  zoomBy(factor: number) {
    this.zoomAt(W / 2, H / 2, factor);
  }

  destroy() {
    window.removeEventListener('pointerup', this.onWindowUp);
    stopMusic();
    this.app.destroy(true, { children: true });
  }

  // ---------- level construction ----------

  private buildLevel(def: LevelDef) {
    this.clearWorld();
    this.physics = new Physics(def, e => this.onPhysEvent(e));
    this.worldW = def.world.width;
    this.sky.width = this.worldW;
    this.hills.width = this.worldW;
    this.groundG.clear().rect(0, GROUND_Y, this.worldW, H - GROUND_Y).fill('#7cb342');
    this.groundG.rect(0, GROUND_Y, this.worldW, 8).fill('#558b2f');
    this.cam = { x: 0, y: 0, scale: 1 };
    this.applyCamera();
  }

  private clearWorld() {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.world.removeChildren();
    this.guide.clear();
    this.slingBands.clear();
    this.physics = null;
  }

  // ---------- camera ----------

  private applyCamera() {
    this.root.position.set(this.cam.x, this.cam.y);
    this.root.scale.set(this.cam.scale);
  }

  private clampCamera() {
    const s = this.cam.scale;
    const minX = W - this.worldW * s;
    this.cam.x = minX > 0 ? minX / 2 : Math.min(0, Math.max(minX, this.cam.x));
    const minY = H - H * s;
    this.cam.y = minY > 0 ? minY / 2 : Math.min(0, Math.max(minY, this.cam.y));
  }

  private screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.cam.x) / this.cam.scale, y: (sy - this.cam.y) / this.cam.scale };
  }

  private zoomAt(sx: number, sy: number, factor: number) {
    if (!this.physics) return;
    const p = this.screenToWorld(sx, sy);
    this.cam.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.cam.scale * factor));
    this.cam.x = sx - p.x * this.cam.scale;
    this.cam.y = sy - p.y * this.cam.scale;
    this.userPanned = true;
    this.clampCamera();
    this.applyCamera();
  }

  // Follows the last bird in flight; if there is none, returns to the slingshot.
  private followCamera(dt: number) {
    if (!this.physics || this.dragging || this.panning || this.userPanned) return;
    const s = this.cam.scale;
    const active = this.physics.flying.filter(b => (b.getUserData() as Entity).kind === 'bird').pop();
    const targetX = active ? W * 0.35 - xPx(active.getPosition().x) * s : W * 0.25 - ANCHOR.x * s;
    this.cam.x += (targetX - this.cam.x) * Math.min(1, dt * 4);
    this.clampCamera();
    this.applyCamera();
  }

  // ---------- physics events -> effects ----------

  private onPhysEvent(e: PhysEvent) {
    switch (e.type) {
      case 'pigDie': sfx.pig(); this.burst(e.x, e.y, e.color, 14, 4); break;
      case 'blockBreak': sfx.breakBlock(e.mat); this.burst(e.x, e.y, e.color, 8, 3); break;
      case 'hit': {
        const now = performance.now();
        if (now - this.lastHit > 80) { this.lastHit = now; sfx.hit(e.rel); }
        break;
      }
      case 'boost': sfx.boost(); break;
      case 'split': sfx.split(); break;
      case 'explode': sfx.explode(); break;
      case 'egg': sfx.egg(); break;
      case 'launch': sfx.launch(); break;
      case 'blast': this.burst(e.x, e.y, '#ff9800', 24, 7); break;
    }
  }

  // ---------- bucle ----------

  private tick(dt: number) {
    if (this.screen === 'playing' && this.physics) {
      this.acc += dt;
      while (this.acc >= STEP && this.screen === 'playing') {
        this.stepWorld();
        this.acc -= STEP;
      }
    } else {
      this.acc = 0;
    }
    this.followCamera(dt);
    this.syncViews();
    this.drawGuide();
    this.drawRest();
    this.updateParticles();
  }

  private stepWorld() {
    if (!this.physics) return;
    const before = this.score;
    this.physics.step(STEP);
    this.physics.processDead(
      body => this.removeView(body),
      pts => { this.score += pts; },
    );
    this.checkEnd();
    if (this.score !== before) this.emitState();
  }

  private checkEnd() {
    if (!this.physics) return;
    if (this.physics.pigs().length === 0) {
      this.score += this.physics.queue.length * POINTS.unusedBird;
      this.finish(true);
    } else if (this.physics.flying.length === 0 && this.physics.queue.length === 0) {
      this.finish(false);
    }
  }

  private finish(won: boolean) {
    const n = stars(this.score, won, STAR_THRESHOLDS);
    if (won) this.progress = saveStars(this.progress, this.levelIndex, n);
    this.lastStars = n;
    this.screen = won ? 'won' : 'lost';
    stopMusic();
    sfx[won ? 'win' : 'lose']();
    this.emitState();
  }

  // ---------- vistas ----------

  private syncViews() {
    if (!this.physics) return;
    for (let b = this.physics.world.getBodyList(); b; b = b.getNext()) {
      const e = b.getUserData() as Entity | null;
      if (!e || e.kind === 'ground') continue;
      let v = this.views.get(b);
      if (!v) { v = this.createView(e); this.views.set(b, v); this.world.addChild(v); }
      const p = b.getPosition();
      v.position.set(xPx(p.x), yPx(p.y));
      v.rotation = -b.getAngle();
      if (e.kind === 'pig') this.setPigFrame(v as Sprite, e);
      if (e.kind === 'bird' && e.used && e.type === 'yellow') (v as Sprite).texture = this.tex(DASH);
    }
    for (const b of [...this.views.keys()]) {
      if (b.getWorld() !== this.physics.world) this.removeView(b);
    }
  }

  private createView(e: Entity): Container {
    if (e.kind === 'bird') {
      const s = new Sprite(this.tex(BIRD_FRAMES[e.type][0]));
      s.anchor.set(0.5);
      s.scale.set((BIRDS[e.type].r * 2.8) / s.texture.width);
      return s;
    }
    if (e.kind === 'pig') {
      const s = new Sprite(this.tex(pigFrame(e.t, 0)));
      s.anchor.set(0.5);
      s.scale.set((PIG_TYPES[e.t].r * 2.4) / s.texture.width);
      return s;
    }
    if (e.kind === 'block') {
      const t = new TilingSprite({ texture: this.blockTextures.get(e.mat)!, width: e.w, height: e.h });
      t.anchor.set(0.5);
      return t;
    }
    return new Graphics().circle(0, 0, 0.15 * 50).fill('#fafafa').stroke({ width: 2, color: 0x333333 });
  }

  private setPigFrame(s: Sprite, e: Extract<Entity, { kind: 'pig' }>) {
    const idx = pigStage(e.hp, e.maxhp, PIG_TYPES[e.t].frames);
    const tex = this.tex(pigFrame(e.t, idx));
    if (s.texture !== tex) s.texture = tex;
  }

  private tex(name: string): Texture {
    const t = this.textures.get(name);
    if (!t) throw new Error(`Texture not loaded: ${name}`);
    return t;
  }

  private removeView(b: Body) {
    const v = this.views.get(b);
    if (v) { v.destroy(); this.views.delete(b); }
  }

  // ---------- slingshot, guide and queue ----------

  private drawRest() {
    this.slingBands.clear();
    this.birdAtRest.removeChildren();
    this.queueLayer.removeChildren();
    if (!this.physics) return;
    if (!this.slingBuilt) this.buildSling();
    const type = this.physics.queue[0];
    if (type && this.physics.flying.length === 0) {
      const bx = ANCHOR.x + this.drag.x, by = ANCHOR.y + this.drag.y;
      const s = new Sprite(this.tex(BIRD_FRAMES[type][0]));
      s.anchor.set(0.5);
      s.scale.set((BIRDS[type].r * 2.8) / s.texture.width);
      s.position.set(bx, by);
      this.birdAtRest.addChild(s);
      if (this.dragging) {
        this.slingBands.moveTo(this.tipL.x, this.tipL.y).lineTo(bx, by).lineTo(this.tipR.x, this.tipR.y)
          .stroke({ width: 3 / this.cam.scale, color: 0x3e2723 });
      }
    }
    // bird queue on screen: does not move with the camera
    const y = Math.min(H - 18, this.cam.y + GROUND_Y * this.cam.scale - 18);
    for (let i = 1; i < this.physics.queue.length; i++) {
      const s = new Sprite(this.tex(BIRD_FRAMES[this.physics.queue[i]][0]));
      s.anchor.set(0.5);
      s.scale.set(26 / s.texture.width);
      s.position.set(40 + i * 32, y);
      this.queueLayer.addChild(s);
    }
  }

  private buildSling() {
    this.slingBuilt = true;
    const l = new Sprite(this.tex(SLING_L));
    l.height = SLING_H;
    l.anchor.set(0.5, 1);
    l.position.set(this.tipL.x, GROUND_Y);
    const r = new Sprite(this.tex(SLING_R));
    r.height = SLING_H;
    r.anchor.set(0.5, 1);
    r.position.set(this.tipR.x, GROUND_Y);
    this.root.addChildAt(l, this.root.getChildIndex(this.world));
    this.root.addChildAt(r, this.root.getChildIndex(this.world));
  }

  private drawGuide() {
    this.guide.clear();
    if (!this.physics || !this.dragging || this.physics.flying.length > 0 || this.physics.queue.length === 0) return;
    const pts = predict(this.physics.queue[0], this.drag, this.worldW);
    for (const p of pts) this.guide.circle(p.x, p.y, 3 / this.cam.scale).fill({ color: 0xffffff, alpha: 0.85 });
  }

  // ---------- particles ----------

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 3).fill(color);
      g.position.set(x, y);
      this.fx.addChild(g);
      this.particles.push({ g, vx: (Math.random() * 2 - 1) * speed, vy: (Math.random() * 2 - 1) * speed - 2, life: 1 });
    }
  }

  private updateParticles() {
    this.particles = this.particles.filter(p => {
      p.vy += 0.25;
      p.g.x += p.vx;
      p.g.y += p.vy;
      p.life -= 0.03;
      p.g.alpha = Math.max(p.life, 0);
      if (p.life <= 0) { p.g.destroy(); return false; }
      return true;
    });
  }

  // ---------- entrada ----------

  private onDown(sx: number, sy: number) {
    if (this.screen !== 'playing' || !this.physics) return;
    const w = this.screenToWorld(sx, sy);
    if (this.physics.flying.length === 0 && this.physics.queue.length > 0 && Math.hypot(w.x - ANCHOR.x, w.y - ANCHOR.y) < 50) {
      this.dragging = true;
      this.drag = this.clampDrag(w.x, w.y);
      return;
    }
    // anything else drags the camera; a tap without moving triggers the ability
    this.panning = true;
    this.panMoved = 0;
    this.panStart = { sx, sy, camX: this.cam.x, camY: this.cam.y };
  }

  private onMove(sx: number, sy: number) {
    if (this.dragging) {
      const w = this.screenToWorld(sx, sy);
      this.drag = this.clampDrag(w.x, w.y);
    } else if (this.panning) {
      const dx = sx - this.panStart.sx, dy = sy - this.panStart.sy;
      this.panMoved = Math.max(this.panMoved, Math.hypot(dx, dy));
      if (this.panMoved > 6) this.userPanned = true;
      this.cam.x = this.panStart.camX + dx;
      this.cam.y = this.panStart.camY + dy;
      this.clampCamera();
      this.applyCamera();
    }
  }

  private onUp() {
    if (this.dragging) {
      this.dragging = false;
      if (Math.hypot(this.drag.x, this.drag.y) > 8 && this.physics) {
        this.physics.launch(this.drag);
        this.drag = { x: 0, y: 0 };
        this.userPanned = false;
        this.emitState();
      }
    } else if (this.panning) {
      this.panning = false;
      if (this.panMoved < 6) this.tapAbility();
    }
  }

  private tapAbility() {
    if (!this.physics) return;
    const target = [...this.physics.flying].reverse().find(b => {
      const e = b.getUserData() as Entity;
      return e.kind === 'bird' && !e.used && e.type !== 'red';
    });
    if (target) this.physics.useAbility(target);
  }

  private clampDrag(x: number, y: number) {
    let dx = x - ANCHOR.x, dy = y - ANCHOR.y;
    const m = Math.hypot(dx, dy);
    if (m > MAX_PULL) { dx = (dx / m) * MAX_PULL; dy = (dy / m) * MAX_PULL; }
    if (ANCHOR.y + dy > GROUND_Y - 20) dy = GROUND_Y - 20 - ANCHOR.y;
    return { x: dx, y: dy };
  }
}
