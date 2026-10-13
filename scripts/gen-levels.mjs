// Generates public/levels/level-XX.json and index.json.
// Levels 1-4: the original prototype levels. Levels 5-30: generated with increasing difficulty rules
// (more towers, birds, tougher pigs and stronger materials). Not hand-verified.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'levels');
mkdirSync(out, { recursive: true });

const HAND = [
  { name: 'First steps', birds: ['red', 'blue', 'yellow'], width: 1500,
    blocks: [
      { m: 'wood', x: 660, y: 460, w: 16, h: 80 }, { m: 'wood', x: 740, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 700, y: 412, w: 110, h: 14 }, { m: 'stone', x: 820, y: 465, w: 20, h: 70 },
      { m: 'stone', x: 900, y: 465, w: 20, h: 70 }, { m: 'glass', x: 860, y: 425, w: 110, h: 10 }],
    pigs: [{ x: 700, y: 484, t: 'medium' }, { x: 860, y: 402, t: 'helmet' }] },
  { name: 'Bomb', birds: ['red', 'blue', 'yellow', 'black'], width: 1500,
    blocks: [
      { m: 'wood', x: 560, y: 460, w: 16, h: 80 }, { m: 'wood', x: 630, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 595, y: 412, w: 100, h: 14 }, { m: 'stone', x: 780, y: 480, w: 110, h: 40 },
      { m: 'stone', x: 850, y: 460, w: 20, h: 80 }, { m: 'stone', x: 930, y: 460, w: 20, h: 80 },
      { m: 'glass', x: 890, y: 415, w: 110, h: 10 }],
    pigs: [{ x: 595, y: 484, t: 'medium' }, { x: 780, y: 442, t: 'helmet' }, { x: 890, y: 480, t: 'large' }] },
  { name: 'Towers', birds: ['red', 'blue', 'yellow', 'white', 'black'], width: 1500,
    blocks: [
      { m: 'wood', x: 520, y: 460, w: 16, h: 80 }, { m: 'wood', x: 600, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 560, y: 412, w: 110, h: 14 }, { m: 'stone', x: 700, y: 460, w: 20, h: 80 },
      { m: 'stone', x: 780, y: 460, w: 20, h: 80 }, { m: 'stone', x: 740, y: 414, w: 110, h: 12 },
      { m: 'glass', x: 860, y: 460, w: 16, h: 80 }, { m: 'glass', x: 930, y: 460, w: 16, h: 80 },
      { m: 'glass', x: 895, y: 412, w: 100, h: 10 }],
    pigs: [{ x: 560, y: 484, t: 'medium' }, { x: 740, y: 394, t: 'helmet' }, { x: 895, y: 380, t: 'large' }] },
  { name: 'King', birds: ['red', 'blue', 'yellow', 'black', 'red', 'blue'], width: 1500,
    blocks: [
      { m: 'wood', x: 520, y: 460, w: 16, h: 80 }, { m: 'wood', x: 600, y: 460, w: 16, h: 80 },
      { m: 'wood', x: 560, y: 412, w: 100, h: 14 }, { m: 'stone', x: 760, y: 480, w: 130, h: 40 },
      { m: 'stone', x: 860, y: 460, w: 20, h: 80 }, { m: 'stone', x: 900, y: 460, w: 20, h: 80 },
      { m: 'glass', x: 880, y: 412, w: 80, h: 10 }],
    pigs: [{ x: 560, y: 484, t: 'medium' }, { x: 760, y: 440, t: 'helmet' }, { x: 880, y: 378, t: 'king' }] },
];

// Deterministic RNG so generated levels stay the same between runs
let seed = 20260101;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function generated(i) {
  const width = 2000 + i * 50;
  const towers = 3 + Math.floor(i / 7);
  const pool = ['red', 'blue', 'yellow', 'black', 'white'];
  const birdCount = 3 + Math.floor(i / 6);
  const birds = Array.from({ length: birdCount }, (_, k) => (k === 0 ? 'red' : pool[(k + i) % pool.length]));
  const span = width - 900;
  const blocks = [];
  const pigs = [];
  for (let k = 0; k < towers; k++) {
    const x = 700 + (k * span) / towers + (rand() - 0.5) * 40;
    const mat = i < 8 ? 'wood' : i < 16 ? (k % 2 ? 'stone' : 'wood') : (k % 3 === 0 ? 'glass' : 'stone');
    const pigType = k === towers - 1 && i >= 20 ? 'king' : i % 5 === 4 ? 'large' : i >= 10 && k % 2 ? 'helmet' : 'medium';
    const tpl = (k + i) % 3;
    if (tpl === 0) {  // box: two posts and a roof
      blocks.push({ m: mat, x: x - 40, y: 460, w: 16, h: 80 }, { m: mat, x: x + 40, y: 460, w: 16, h: 80 },
        { m: mat, x, y: 412, w: 110, h: 14 });
      pigs.push({ x, y: 484, t: pigType === 'king' ? 'king' : pigType === 'large' ? 'large' : 'medium' });
    } else if (tpl === 1) {  // slab with a pig on top
      blocks.push({ m: 'stone', x, y: 480, w: 110, h: 40 });
      pigs.push({ x, y: 442, t: pigType === 'large' ? 'helmet' : pigType });
    } else {  // tall tower with a pig inside
      blocks.push({ m: mat, x: x - 42, y: 460, w: 16, h: 80 }, { m: mat, x: x + 42, y: 460, w: 16, h: 80 },
        { m: 'wood', x, y: 412, w: 100, h: 14 }, { m: 'glass', x, y: 380, w: 80, h: 10 });
      pigs.push({ x, y: 484, t: 'medium' });
    }
  }
  return { name: `Level ${i + 1}`, birds, width, blocks, pigs };
}

const all = [...HAND, ...Array.from({ length: 26 }, (_, i) => generated(i + 4))];
const index = [];
all.forEach((lv, i) => {
  const id = i + 1;
  const file = `level-${String(id).padStart(2, '0')}.json`;
  const json = { id, name: lv.name, world: { width: lv.width, height: 540 }, birds: lv.birds, blocks: lv.blocks, pigs: lv.pigs };
  writeFileSync(join(out, file), JSON.stringify(json, null, 2) + '\n');
  index.push({ id, name: lv.name, file });
});
writeFileSync(join(out, 'index.json'), JSON.stringify({ levels: index }, null, 2) + '\n');
console.log(`levels: ${all.length}`);
