import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics } from './physics';
import type { LevelDef } from './types';

const level1 = JSON.parse(readFileSync('public/levels/level-01.json', 'utf8')) as LevelDef;

// Real simulation with Planck: a well-aimed shot must pop pigs on level 1.
function shoot(drag: { x: number; y: number }, seconds = 12) {
  const p = new Physics(level1, () => {});
  const before = p.pigs().length;
  p.launch(drag);
  for (let i = 0; i < seconds * 60; i++) {
    p.step(1 / 60);
    p.processDead(() => {}, () => {});
  }
  return before - p.pigs().length;
}

test('some launch angle pops at least one pig on level 1', () => {
  const angles = [0.3, 0.4, 0.5, 0.6];
  const kills = angles.map(a => shoot({ x: -Math.cos(a) * 90, y: Math.sin(a) * 90 }));
  assert.ok(Math.max(...kills) >= 1, `kills per angle: ${kills.join(',')}`);
});

test('a weak shot does not pop the helmet pig', () => {
  const p = new Physics(level1, () => {});
  p.launch({ x: -10, y: 10 });
  for (let i = 0; i < 6 * 60; i++) {
    p.step(1 / 60);
    p.processDead(() => {}, () => {});
  }
  assert.equal(p.pigs().length, 2);
});
