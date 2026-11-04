/**
 * 走子的腳步、吃子的撞擊，加上每種子的短喊。
 * 喊聲在 assets/voice/。檔案沒有載入時，改用系統的中文語音。
 */

const LINES = {
  m: ["將進", "護駕", "象踏", "馬出", "車出", "炮行", "兵進"],
  h: ["拿下", "斬了", "鎮住", "踏碎", "衝殺", "轟碎", "擒下"],
  flip: "翻子",
  fire: "開炮",
};

let enabled = true;
let ctx = null;
let master = null;
let noiseBuf = null;

export function setSoundEnabled(on) {
  enabled = on;
  if (!on && window.speechSynthesis) speechSynthesis.cancel();
}

function context() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

function unlock() {
  const audio = context();
  if (audio.state === "suspended") audio.resume();
}

function noise() {
  const audio = context();
  if (noiseBuf) return noiseBuf;
  const n = audio.sampleRate;
  noiseBuf = audio.createBuffer(1, n, audio.sampleRate);
  const data = noiseBuf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = brown * 3.5;
  }
  return noiseBuf;
}

function burst(at, duration, freq, q, peak) {
  const audio = context();
  const src = audio.createBufferSource();
  src.buffer = noise();
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(at);
  src.stop(at + duration + 0.02);
}

function tone(at, freq, endFreq, duration, type, peak) {
  const audio = context();
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(30, freq), at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), at + duration);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

function say(name, text) {
  const clip = new Audio(`assets/voice/${name}.wav`);
  clip.volume = 1;
  clip.addEventListener("error", () => speak(text), { once: true });
  clip.play().catch(() => speak(text));
}

function speak(text) {
  if (!text || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.9;
  utterance.pitch = 0.65;
  utterance.volume = 1;
  const voice = speechSynthesis.getVoices().find((item) => /Zhiwei|志偉|Yating|Hanhan|zh-TW/i.test(`${item.name} ${item.lang}`));
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function moveBody(type, at, cannon) {
  if (cannon) {
    tone(at, 140, 70, 0.22, "triangle", 0.08);
    burst(at, 0.18, 500, 0.6, 0.08);
    return;
  }
  if (type === 0) {
    tone(at, 98, 70, 0.4, "sine", 0.16);
    tone(at + 0.02, 196, 140, 0.28, "triangle", 0.04);
  } else if (type === 1) {
    burst(at, 0.16, 900, 0.7, 0.07);
    tone(at, 280, 190, 0.16, "triangle", 0.05);
  } else if (type === 2) {
    tone(at, 62, 40, 0.24, "sine", 0.2);
    tone(at + 0.26, 58, 36, 0.24, "sine", 0.2);
    burst(at, 0.16, 180, 0.5, 0.12);
    burst(at + 0.26, 0.16, 160, 0.5, 0.12);
  } else if (type === 3) {
    for (let i = 0; i < 3; i++) {
      tone(at + i * 0.11, 160, 90, 0.08, "triangle", 0.09);
      burst(at + i * 0.11, 0.06, 280, 0.8, 0.08);
    }
  } else if (type === 4) {
    tone(at, 52, 40, 0.4, "sine", 0.14);
    burst(at, 0.42, 220, 0.4, 0.16);
  } else if (type === 6) {
    tone(at, 220, 150, 0.08, "triangle", 0.05);
    tone(at + 0.12, 210, 140, 0.08, "triangle", 0.05);
    burst(at, 0.05, 1600, 0.7, 0.04);
    burst(at + 0.12, 0.05, 1600, 0.7, 0.04);
  } else {
    burst(at, 0.2, 480, 0.5, 0.06);
  }
}

function hitBody(type, cannon, at) {
  const heavy = cannon || type === 0 || type === 2 || type === 4;
  tone(at, heavy ? 82 : 130, 34, heavy ? 0.5 : 0.28, "sine", heavy ? 0.3 : 0.16);
  burst(at, heavy ? 0.45 : 0.22, heavy ? 220 : 640, 0.5, heavy ? 0.28 : 0.14);
  burst(at, 0.07, 1800, 0.4, cannon ? 0.18 : 0.08);
  if (cannon) {
    tone(at, 64, 30, 0.7, "sine", 0.34);
    burst(at + 0.04, 0.55, 140, 0.35, 0.2);
  }
}

export function playCue(cue) {
  if (!cue) return;
  if (cue.kind === "unlock") {
    unlock();
    return;
  }
  if (!enabled) return;
  unlock();
  const at = context().currentTime + 0.012;
  const type = cue.type ?? 6;
  if (cue.kind === "move") {
    moveBody(type, at, cue.cannon && cue.capture);
    if (cue.voice === false) return;
    if (cue.cannon && cue.capture) say("fire", LINES.fire);
    else say(`m${type}`, LINES.m[type]);
  } else if (cue.kind === "hit") {
    hitBody(type, !!cue.cannon, at);
    if (cue.voice !== false) say(`h${type}`, LINES.h[type]);
  } else if (cue.kind === "flip") {
    burst(at, 0.16, 640, 0.7, 0.08);
    tone(at, 240, 160, 0.14, "triangle", 0.05);
    say("flip", LINES.flip);
  }
}
