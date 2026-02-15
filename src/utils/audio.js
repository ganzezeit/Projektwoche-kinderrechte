// audio.js — SFX only (music is handled by audioManager.js)
import { audioManager } from './audioManager';

let globalVolume = 0.3;

// --- Volume control (applies to both SFX and music) ---

export function setVolume(vol) {
  globalVolume = Math.max(0, Math.min(1, vol));
  audioManager.setVolume(vol);
}

export function getVolume() {
  return globalVolume;
}

// --- SFX via AudioContext ---

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, dur, vol = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.value = globalVolume * vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (e) {}
}

export function playClickSound() {
  playTone(800, 'sine', 0.08, 0.2);
}

export function playSuccessSound() {
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => playTone(f, 'sine', 0.25, 0.25), i * 120);
  });
}

export function playCompleteSound() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 'triangle', 0.4, 0.3), i * 150);
  });
}

export function playWrongSound() {
  playTone(200, 'sawtooth', 0.3, 0.15);
}
