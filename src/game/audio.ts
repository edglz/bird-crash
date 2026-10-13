// Game audio. Sound effects in public/audio (loaded with Web Audio) and looping music via <audio>.
// The files come from AngryBirdsRemakeUnity (code under MIT; the sounds belong to Rovio: personal use only).
// The audio context is created on the first click (browser autoplay policy).

const VOLUME = 0.6;
const MUTE_KEY = 'bird-crash-muted';

const FILES = {
  launch: 'launch.wav',
  hitWood: 'hit-wood.wav',
  hitStone: 'hit-stone.wav',
  hitGlass: 'hit-glass.wav',
  breakWood: 'break-wood.wav',
  breakStone: 'break-stone.wav',
  breakGlass: 'break-glass.wav',
  pigDie: 'pig-die.wav',
  pigDamage: 'pig-damage.wav',
  boost: 'boost.wav',
  split: 'split.wav',
  explode: 'explode.wav',
  egg: 'egg.wav',
  eggExplode: 'egg-explode.wav',
  birdDie: 'bird-die.wav',
  menuSelect: 'menu-select.wav',
  menuConfirm: 'menu-confirm.wav',
  star1: 'star-1.mp3',
  star2: 'star-2.mp3',
  star3: 'star-3.mp3',
  win: 'win.mp3',
  lose: 'lose.mp3',
} as const;
type SfxName = keyof typeof FILES;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<SfxName, AudioBuffer>();
let muted = localStorage.getItem(MUTE_KEY) === '1';
const bgm = new Audio('/audio/music.mp3');
bgm.loop = true;
bgm.volume = 0.35;
bgm.muted = muted;

function init() {
  if (ctx) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);
  void loadBuffers(ctx);
}

async function loadBuffers(c: AudioContext) {
  await Promise.all((Object.keys(FILES) as SfxName[]).map(async name => {
    try {
      const res = await fetch(`/audio/${FILES[name]}`);
      buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // if a file is missing, its event simply stays silent
    }
  }));
}

function play(name: SfxName, volume = 1, rate = 1) {
  init();
  const buf = buffers.get(name);
  if (!buf || !ctx || !master) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  g.gain.value = volume;
  src.connect(g);
  g.connect(master);
  src.start();
}

export const sfx = {
  launch: () => play('launch'),
  hit: (v: number) => play('hitWood', Math.min(1, v / 12)),
  pig: () => play('pigDie'),
  pigDamage: () => play('pigDamage', 0.6),
  breakBlock: (mat: 'wood' | 'stone' | 'glass') => play(mat === 'stone' ? 'breakStone' : mat === 'glass' ? 'breakGlass' : 'breakWood'),
  boost: () => play('boost'),
  split: () => play('split'),
  explode: () => play('explode'),
  egg: () => play('egg'),
  eggExplode: () => play('eggExplode'),
  click: () => play('menuSelect'),
  confirm: () => play('menuConfirm'),
  star: (n: 1 | 2 | 3) => play(n === 1 ? 'star1' : n === 2 ? 'star2' : 'star3'),
  win: () => play('win'),
  lose: () => play('lose'),
};

export function playMusic() {
  init();
  bgm.muted = muted;
  void bgm.play().catch(() => { /* blocked until the next user gesture */ });
}

export function stopMusic() {
  bgm.pause();
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  bgm.muted = muted;
  if (master) master.gain.value = muted ? 0 : VOLUME;
  return muted;
}

export const isMuted = () => muted;
