import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blastDamage, contactDamage, pigStage, stars } from './rules';

test('pig: bird kills any pig but king', () => {
  assert.equal(contactDamage({ kind: 'pig', t: 'medium', hp: 75, maxhp: 75 }, { kind: 'bird', type: 'red', age: 0, used: false }, 5), Infinity);
  assert.equal(contactDamage({ kind: 'pig', t: 'king', hp: 200, maxhp: 200 }, { kind: 'bird', type: 'red', age: 0, used: false }, 5), 5 * 8);
});

test('pig: non-bird damage = relative speed × 8', () => {
  assert.equal(contactDamage({ kind: 'pig', t: 'large', hp: 125, maxhp: 125 }, { kind: 'block', mat: 'wood', hp: 100, w: 1, h: 1 }, 3), 24);
});

test('block: non-bird damage = speed × 5, bird hits double', () => {
  const wood = { kind: 'block' as const, mat: 'wood' as const, hp: 100, w: 1, h: 1 };
  assert.equal(contactDamage(wood, null, 4), 20);
  assert.equal(contactDamage(wood, { kind: 'bird', type: 'red', age: 0, used: false }, 4), 40);
});

test('blast: full damage at center, zero at the radius', () => {
  assert.equal(blastDamage(0, 100), 200);
  assert.equal(blastDamage(50, 100), 100);
  assert.equal(blastDamage(100, 100), 0);
});

test('pig stage goes from healthy to damaged', () => {
  assert.equal(pigStage(75, 75, 9), 0);
  assert.equal(pigStage(0, 75, 9), 8);
});

test('stars: 0 when lost, 1..3 by score thresholds', () => {
  assert.equal(stars(99999, false, [5000, 12000]), 0);
  assert.equal(stars(1000, true, [5000, 12000]), 1);
  assert.equal(stars(6000, true, [5000, 12000]), 2);
  assert.equal(stars(13000, true, [5000, 12000]), 3);
});
