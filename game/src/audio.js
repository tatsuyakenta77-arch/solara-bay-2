// Audio: all sound is synthesized with WebAudio — no external files.
// Engine hum, siren, gunshot, pickup chime, punch thud, UI blips and a bass loop.
let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, musicTimer = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
    startMusic();
  } catch { ctx = null; }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
export function setEngine(speed01, driving) {
  if (!ctx) return;
  engineGain.gain.value = driving ? 0.05 + speed01 * 0.06 : 0;
  engineOsc.frequency.value = 45 + speed01 * 130;
}
export function setSiren(on) {
  if (!ctx) return;
  sirenGain.gain.value = on ? 0.045 : 0;
  if (on) {
    const t = ctx.currentTime;
    sirenOsc.frequency.cancelScheduledValues(t);
    sirenOsc.frequency.setValueAtTime(660, t);
    sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.35);
    sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.7);
  }
}
function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
function noiseBurst(dur, vol, freq) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
  const g = ctx.createGain(); g.gain.value = vol || 0.3;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}
export const sfx = {
  shoot() { noiseBurst(0.12, 0.35, 3000); blip(180, 0.08, 'square', 0.12, 60); },
  punch() { noiseBurst(0.08, 0.25, 400); },
  hit() { blip(140, 0.12, 'sawtooth', 0.15, 70); },
  pickup() { blip(660, 0.09, 'sine', 0.2); setTimeout(() => blip(990, 0.14, 'sine', 0.2), 90); },
  cash() { blip(880, 0.08, 'sine', 0.2); setTimeout(() => blip(1174, 0.1, 'sine', 0.2), 80); setTimeout(() => blip(1568, 0.18, 'sine', 0.2), 160); },
  crash() { noiseBurst(0.25, 0.4, 700); },
  horn() { blip(370, 0.25, 'square', 0.12); blip(466, 0.25, 'square', 0.08); },
  sirenBlip() { blip(900, 0.15, 'triangle', 0.12, 1200); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.18), i * 110)); },
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.15), i * 180)); },
  click() { blip(700, 0.05, 'square', 0.08); },
};
// Simple bass + hat loop for the city vibe.
function startMusic() {
  if (!ctx || musicTimer) return;
  const bass = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
  let i = 0;
  musicTimer = setInterval(() => {
    if (!ctx || muted) { i = (i + 1) % bass.length; return; }
    const f = bass[i % bass.length];
    if (f) blip(f, 0.22, 'triangle', 0.12);
    if (i % 2 === 0) noiseBurst(0.03, 0.03, 6000);
    i = (i + 1) % bass.length;
  }, 240);
}
