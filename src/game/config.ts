// Game constants. Screen coordinates in px (960×540, origin top-left).
// Physics uses meters (PPM px per meter) with the Y axis pointing up.

export const W = 960;
export const H = 540;
export const PPM = 50;
export const GROUND_Y = 500;
export const ANCHOR = { x: 172, y: 372 };    // bird's rest position, between the slingshot tips
export const SLING_H = 120;                   // height of the slingshot arms
export const MAX_PULL = 90;                   // max pull, px
export const LAUNCH_SPEED = 9.5;              // m/s per meter of pull
export const STEP = 1 / 60;                   // fixed physics step, s
export const STAR_THRESHOLDS = [5000, 12000]; // points for 2 and 3 stars (own values)

// Points (values from the AngryBirdsRemakeUnity repo, MIT)
export const POINTS = { pig: 5000, block: 500, unusedBird: 10000 };

export type BirdType = 'red' | 'blue' | 'yellow' | 'black' | 'white';
export type MatName = 'wood' | 'stone' | 'glass';
export type PigType = 'medium' | 'helmet' | 'large' | 'king';

export const BIRDS: Record<BirdType, { r: number; color: string; mass: number }> = {
  red: { r: 16, color: '#e53935', mass: 1 },
  yellow: { r: 14, color: '#fdd835', mass: 5 },
  blue: { r: 12, color: '#1e88e5', mass: 0.5 },
  black: { r: 16, color: '#263238', mass: 1 },
  white: { r: 15, color: '#f5f5f5', mass: 1 },
};

// HP (repo): wood 100, stone 200, glass 50
export const MATS: Record<MatName, { color: string; hp: number }> = {
  wood: { color: '#a1673a', hp: 100 },
  stone: { color: '#9e9e9e', hp: 200 },
  glass: { color: '#b3e5fc', hp: 50 },
};

// HP (repo): medium 75, large 125, helmet 200; the king doesn't die from one bird hit (wiki)
export const PIG_TYPES: Record<PigType, { r: number; hp: number; frames: number }> = {
  medium: { r: 16, hp: 75, frames: 9 },
  helmet: { r: 18, hp: 200, frames: 8 },
  large: { r: 22, hp: 125, frames: 9 },
  king: { r: 26, hp: 200, frames: 10 },
};
