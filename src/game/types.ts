import type { BirdType, MatName, PigType } from './config';

export interface BlockDef { m: MatName; x: number; y: number; w: number; h: number }
export interface PigDef { x: number; y: number; t: PigType }

// Format of public/levels/level-XX.json
export interface LevelDef {
  id: number;
  name: string;
  world: { width: number; height: number };
  birds: BirdType[];
  blocks: BlockDef[];
  pigs: PigDef[];
}

export interface LevelIndexItem { id: number; name: string; file: string }

// Data attached to each Planck body (userData)
export type Entity =
  | { kind: 'ground' }
  | { kind: 'bird'; type: BirdType; age: number; used: boolean }
  | { kind: 'pig'; t: PigType; hp: number; maxhp: number }
  | { kind: 'block'; mat: MatName; hp: number; w: number; h: number }
  | { kind: 'egg'; spawnedAt: number };
