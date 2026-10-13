import { Body, Box, Circle, Contact, Vec2, World } from 'planck';
import {
  ANCHOR, BIRDS, GROUND_Y, H, LAUNCH_SPEED, MATS, PIG_TYPES, PPM, POINTS,
  type BirdType,
} from './config';
import { blastDamage, contactDamage, initialHp } from './rules';
import type { Entity, LevelDef } from './types';

// Conversion from px (origin top-left) to meters (Y up)
export const toM = (px: number) => px / PPM;
export const yM = (py: number) => (H - py) / PPM;
export const xPx = (mx: number) => mx * PPM;
export const yPx = (my: number) => H - my * PPM;

export type PhysEvent =
  | { type: 'pigDie'; x: number; y: number; color: string }
  | { type: 'blockBreak'; x: number; y: number; color: string; mat: 'wood' | 'stone' | 'glass' }
  | { type: 'hit'; rel: number }
  | { type: 'boost' | 'split' | 'explode' | 'egg' | 'launch' }
  | { type: 'blast'; x: number; y: number; r: number };

export type Emit = (e: PhysEvent) => void;

const GRAVITY = -10;
const PIG_COLOR = '#7cb342';

export class Physics {
  readonly world: World;
  queue: BirdType[] = [];
  readonly dead = new Set<Body>();
  flying: Body[] = [];
  time = 0;
  private pending: Array<() => void> = [];

  private readonly emit: Emit;
  readonly worldW: number;

  constructor(level: LevelDef, emit: Emit) {
    this.emit = emit;
    this.worldW = level.world.width;
    this.world = new World({ gravity: Vec2(0, GRAVITY) });
    this.addStatic(Vec2(toM(this.worldW / 2), yM(GROUND_Y + 30)), Box(toM(this.worldW), toM(30)), { kind: 'ground' });
    this.addStatic(Vec2(toM(-20), yM(H / 2)), Box(toM(20), toM(H)), { kind: 'ground' });
    for (const d of level.blocks) this.makeBlock(d.m, d.x, d.y, d.w, d.h);
    for (const d of level.pigs) this.makePig(d.t, d.x, d.y);
    this.world.on('begin-contact', (c: Contact) => this.onContact(c));
    this.queue = [...level.birds];
  }

  private addStatic(pos: Vec2, shape: ReturnType<typeof Box>, data: Entity) {
    const b = this.world.createBody({ type: 'static', position: pos });
    b.createFixture({ shape, friction: 0.6 });
    b.setUserData(data);
    return b;
  }

  private makeBlock(m: 'wood' | 'stone' | 'glass', x: number, y: number, w: number, h: number) {
    const b = this.world.createBody({ type: 'dynamic', position: Vec2(toM(x), yM(y)) });
    b.createFixture({ shape: Box(toM(w / 2), toM(h / 2)), density: 1, friction: 0.6, restitution: 0.1 });
    const e: Entity = { kind: 'block', mat: m, hp: 0, w, h };
    e.hp = initialHp(e);
    b.setUserData(e);
    return b;
  }

  private makePig(t: keyof typeof PIG_TYPES, x: number, y: number) {
    const r = PIG_TYPES[t].r;
    const b = this.world.createBody({ type: 'dynamic', position: Vec2(toM(x), yM(y)) });
    b.createFixture({ shape: Circle(toM(r)), density: 1 / (Math.PI * toM(r) ** 2), friction: 0.5, restitution: 0.1 });
    const e: Entity = { kind: 'pig', t, hp: PIG_TYPES[t].hp, maxhp: PIG_TYPES[t].hp };
    b.setUserData(e);
    return b;
  }

  makeBird(type: BirdType, x: number, y: number): Body {
    const { r, mass } = BIRDS[type];
    const rm = toM(r);
    const b = this.world.createBody({ type: 'dynamic', position: Vec2(toM(x), yM(y)), bullet: true });
    b.createFixture({ shape: Circle(rm), density: mass / (Math.PI * rm * rm), friction: 0.5, restitution: 0.3 });
    b.setUserData({ kind: 'bird', type, age: 0, used: false } satisfies Entity);
    return b;
  }

  // Launches the bird from the drag position (px). The pull goes the opposite way.
  launch(drag: { x: number; y: number }) {
    const type = this.queue.shift();
    if (!type) return;
    const b = this.makeBird(type, ANCHOR.x + drag.x, ANCHOR.y + drag.y);
    const k = LAUNCH_SPEED / PPM;
    b.setLinearVelocity(Vec2(-drag.x * k, drag.y * k));
    this.flying.push(b);
    this.emit({ type: 'launch' });
  }

  private onContact(c: Contact) {
    const A = c.getFixtureA().getBody(), B = c.getFixtureB().getBody();
    const ea = A.getUserData() as Entity, eb = B.getUserData() as Entity;
    const va = A.getLinearVelocity(), vb = B.getLinearVelocity();
    const rel = Math.hypot(va.x - vb.x, va.y - vb.y);
    this.hurt(A, ea, eb, rel);
    this.hurt(B, eb, ea, rel);
    if (rel > 4) this.emit({ type: 'hit', rel });
    for (const [body, e] of [[A, ea], [B, eb]] as const) {
      // egg: explodes when it touches something, except right after launch
      if (e.kind === 'egg' && this.time - e.spawnedAt > 0.2) this.pending.push(() => this.eggBlast(body));
      // black bomb: explodes on landing
      if (e.kind === 'bird' && e.type === 'black' && !e.used && e.age > 0.15) this.pending.push(() => this.explodeBird(body));
    }
  }

  private hurt(target: Body, e: Entity, other: Entity, rel: number) {
    if (e.kind !== 'pig' && e.kind !== 'block') return;
    const d = contactDamage(e, other, rel);
    if (e.kind === 'pig') {
      if (d === Infinity) { e.hp = 0; this.dead.add(target); return; }
    }
    e.hp -= d;
    if (e.hp <= 0) this.dead.add(target);
  }

  // Applies explosions and removals outside the physics step
  step(dt: number) {
    this.world.step(dt, 8, 3);
    this.time += dt;
    for (const fn of this.pending.splice(0)) fn();
    this.updateFlying(dt);
  }

  private updateFlying(dt: number) {
    for (const b of this.flying) {
      const e = b.getUserData() as Entity & { kind: 'bird' };
      e.age += dt;
      const v = b.getLinearVelocity();
      const speed = Math.hypot(v.x, v.y);
      const p = b.getPosition();
      const off = xPx(p.x) > this.worldW + 100 || xPx(p.x) < -100 || yPx(p.y) > H + 100;
      if (off || (e.age > 1 && speed < 0.3) || e.age > 10) this.dead.add(b);
    }
  }

  // Abilities when tapped during flight
  useAbility(b: Body) {
    const e = b.getUserData() as Entity & { kind: 'bird' };
    if (e.used || e.type === 'red') return;
    e.used = true;
    const v = b.getLinearVelocity();
    const p = b.getPosition();
    switch (e.type) {
      case 'yellow':
        b.setLinearVelocity(Vec2(v.x * 2, v.y * 2));
        this.emit({ type: 'boost' });
        break;
      case 'blue':
        for (const dy of [-3, 3]) {
          const c = this.makeBird('blue', xPx(p.x), yPx(p.y));
          (c.getUserData() as Entity & { kind: 'bird' }).used = true;
          c.setLinearVelocity(Vec2(v.x, v.y + dy));
          this.flying.push(c);
        }
        this.emit({ type: 'split' });
        break;
      case 'black':
        this.explodeBird(b);
        break;
      case 'white': {
        // Matilda lays an egg and is launched upward (repo rule)
        const egg = this.world.createBody({ type: 'dynamic', position: Vec2(p.x, p.y - 0.5), bullet: true });
        egg.createFixture({ shape: Circle(0.15), density: 1 / (Math.PI * 0.15 * 0.15), restitution: 0.2 });
        egg.setUserData({ kind: 'egg', spawnedAt: this.time } satisfies Entity);
        b.setLinearVelocity(Vec2(v.x, v.y <= 0 ? -v.y + 20 : v.y + 20));
        this.emit({ type: 'egg' });
        break;
      }
    }
  }

  private explodeBird(b: Body) {
    const p = b.getPosition();
    this.blast(p, 2, b);
    this.dead.add(b);
  }

  private eggBlast(egg: Body) {
    this.blast(egg.getPosition(), 1.5, egg);
    this.dead.add(egg);
  }

  // Explosion: pushes everything inside the radius and damages pigs and blocks
  private blast(p: { x: number; y: number }, radius: number, source: Body) {
    this.emit({ type: 'blast', x: xPx(p.x), y: yPx(p.y), r: radius * PPM });
    this.emit({ type: 'explode' });
    for (let body = this.world.getBodyList(); body; body = body.getNext()) {
      if (body === source || body.isStatic()) continue;
      const q = body.getPosition();
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d === 0) continue;
      const k = 1 - d / radius;
      body.applyLinearImpulse(Vec2((dx / d) * k * 10 * body.getMass(), (dy / d) * k * 10 * body.getMass()), body.getWorldCenter(), true);
      const e = body.getUserData() as Entity;
      if (e.kind === 'pig' || e.kind === 'block') {
        e.hp -= blastDamage(d * PPM, radius * PPM);
        if (e.hp <= 0) this.dead.add(body);
      }
    }
  }

  // Removes marked bodies so the view can drop them
  processDead(onRemove: (b: Body) => void, onScore: (points: number) => void) {
    for (const b of this.dead) {
      if (!b.getWorld()) continue;
      const e = b.getUserData() as Entity;
      if (e.kind === 'pig') {
        onScore(POINTS.pig);
        this.emit({ type: 'pigDie', x: xPx(b.getPosition().x), y: yPx(b.getPosition().y), color: PIG_COLOR });
      } else if (e.kind === 'block') {
        onScore(POINTS.block);
        this.emit({ type: 'blockBreak', x: xPx(b.getPosition().x), y: yPx(b.getPosition().y), color: MATS[e.mat].color, mat: e.mat });
      }
      onRemove(b);
      this.world.destroyBody(b);
      this.flying = this.flying.filter(f => f !== b);
    }
    this.dead.clear();
  }

  pigs(): Body[] {
    const out: Body[] = [];
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      const e = b.getUserData() as Entity | null;
      if (e && e.kind === 'pig') out.push(b);
    }
    return out;
  }
}

// Trajectory: simulates the flight with the same engine and returns points in px.
export function predict(type: BirdType, drag: { x: number; y: number }, worldW: number): Array<{ x: number; y: number }> {
  const w = new World({ gravity: Vec2(0, GRAVITY) });
  w.createBody({ type: 'static', position: Vec2(toM(worldW / 2), yM(GROUND_Y + 30)) }).createFixture({ shape: Box(toM(worldW), toM(30)) });
  const { r, mass } = BIRDS[type];
  const rm = toM(r);
  const b = w.createBody({ type: 'dynamic', position: Vec2(toM(ANCHOR.x + drag.x), yM(ANCHOR.y + drag.y)), bullet: true });
  b.createFixture({ shape: Circle(rm), density: mass / (Math.PI * rm * rm), friction: 0.5, restitution: 0.3 });
  const k = LAUNCH_SPEED / PPM;
  b.setLinearVelocity(Vec2(-drag.x * k, drag.y * k));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 300; i++) {
    w.step(1 / 60, 8, 3);
    if (i % 4 === 0) pts.push({ x: xPx(b.getPosition().x), y: yPx(b.getPosition().y) });
    if (yPx(b.getPosition().y) > GROUND_Y - r || xPx(b.getPosition().x) > worldW) break;
  }
  return pts;
}

