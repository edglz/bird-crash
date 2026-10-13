import { MAX_PULL, MATS, PIG_TYPES } from './config';
import type { Entity } from './types';

// Damage rules, taken from AngryBirdsRemakeUnity (MIT) and the wiki:
// - pig: damage = relative speed (m/s) × 8; a bird kills it in one hit, except the king.
// - block: damage = relative speed × 5; bird hits deal double.
export function contactDamage(target: Entity, other: Entity | null, rel: number): number {
  const fromBird = other?.kind === 'bird';
  if (target.kind === 'pig') {
    if (fromBird && target.t !== 'king') return Infinity;
    return rel * 8;
  }
  if (target.kind === 'block') return rel * 5 * (fromBird ? 2 : 1);
  return 0;
}

// Explosion damage: 200 at the center, falling linearly to 0 at the radius.
export function blastDamage(distance: number, radius: number): number {
  return distance >= radius ? 0 : 200 * (1 - distance / radius);
}

export function initialHp(e: Entity): number {
  if (e.kind === 'pig') return PIG_TYPES[e.t].hp;
  if (e.kind === 'block') return MATS[e.mat].hp;
  return 0;
}

// Visual stage of the pig based on remaining HP (0 = healthy).
export function pigStage(hp: number, maxhp: number, frames: number): number {
  const lost = 1 - Math.max(hp, 0) / maxhp;
  return Math.min(frames - 1, Math.floor(lost * frames));
}

export function stars(score: number, won: boolean, thresholds: number[]): number {
  if (!won) return 0;
  return 1 + thresholds.filter(t => score >= t).length;
}

export const LAUNCH_PULL_MAX = MAX_PULL;
