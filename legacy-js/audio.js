// Sound and music generated with Web Audio: no external files used.
// The context is created on the first click (browser autoplay policy).
const Sound = (() => {
  const VOLUME = 0.6;
  let ctx = null, master = null, noiseBuf = null, timer = null;
  let muted = localStorage.getItem('bird-crash-muted') === '1';

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, t0, dur, type = 'square', vol = 0.2, to = null, dest = null) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(t0, dur, vol = 0.3, freq = 1200, dest = null) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || master);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  const sfx = {
    launch() { init(); const t = ctx.currentTime; noise(t, 0.25, 0.25, 600); tone(300, t, 0.2, 'sawtooth', 0.08, 120); },
    hit(v) { init(); noise(ctx.currentTime, 0.08, Math.min(0.4, v * 0.03), 900); },
    pig() { init(); const t = ctx.currentTime; tone(700, t, 0.25, 'square', 0.12, 200); noise(t, 0.15, 0.2, 1500); },
    block() { init(); noise(ctx.currentTime, 0.2, 0.35, 800); },
    boost() { init(); const t = ctx.currentTime; tone(500, t, 0.3, 'triangle', 0.2, 1200); },
    split() { init(); const t = ctx.currentTime; tone(900, t, 0.15, 'sine', 0.2); tone(1200, t + 0.05, 0.15, 'sine', 0.2); },
    explode() { init(); const t = ctx.currentTime; noise(t, 0.6, 0.6, 200); tone(120, t, 0.5, 'sine', 0.4, 40); },
    win() { init(); [523, 659, 784, 1046].forEach((f, i) => tone(f, ctx.currentTime + i * 0.12, 0.3, 'triangle', 0.2)); },
    lose() { init(); [392, 349, 330, 262].forEach((f, i) => tone(f, ctx.currentTime + i * 0.2, 0.35, 'sawtooth', 0.12)); },
    click() { init(); tone(880, ctx.currentTime, 0.06, 'sine', 0.15); },
  };

  // Music: short loop in A minor with a pentatonic melody, bass and hi-hat.
  const MELODY = [440, 523, 587, 659, 587, 523, 440, 392, 440, 523, 659, 784, 659, 587, 523, 440];
  const BASS = [110, 110, 130.8, 130.8, 98, 98, 110, 110];
  const STEP = 0.25;
  let step = 0, next = 0;

  function schedule() {
    while (next < ctx.currentTime + 0.6) {
      tone(MELODY[step % MELODY.length], next, STEP * 0.9, 'triangle', 0.1);
      if (step % 4 === 0) tone(BASS[Math.floor(step / 4) % BASS.length] / 2, next, STEP * 3.5, 'sine', 0.22);
      if (step % 2 === 0) noise(next, 0.03, 0.05, 6000);
      next += STEP;
      step++;
    }
  }

  function playMusic() {
    init();
    if (timer) return;
    if (ctx.state === 'suspended') ctx.resume();
    next = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 150);
  }

  function stopMusic() {
    clearInterval(timer);
    timer = null;
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem('bird-crash-muted', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : VOLUME;
    return muted;
  }

  return { sfx, playMusic, stopMusic, toggle, isMuted: () => muted };
})();
