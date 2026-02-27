"use strict";

/* ================= CONFIG ================= */

let padsMasterVolume = 1;
let drumsMasterVolume = 1;

const PAD_FADE_TIME = 0.4;
const MIN_LOAD_TIME = 1500;
const CONCURRENCY = 3;

let TOTAL = 0;
let LOADED = 0;
let loadStart = 0;
let audioInitialized = false;

const PAD_FILES = {
  A: "A Pad.mp3",
  "A#": "As Pad.mp3",
  B: "B Pad.mp3",
  C: "C Pad.mp3",
  "C#": "Cs Pad.mp3",
  D: "D Pad.mp3",
  "D#": "Ds Pad.mp3",
  E: "E Pad.mp3",
  F: "F Pad.mp3",
  "F#": "Fs Pad.mp3",
  G: "G Pad.mp3",
  "G#": "Gs Pad.mp3",
};

const DRUM_FILES = {
  a: "OPTN SNARE 1.mp3",
  s: "DIGITAL TOM 3.wav",
  d: "Bethel Tambourine.mp3",
  f: "SOFT TAMBO DRY I(1).mp3",
  g: "CLANK VERB.wav",
  h: "melbournebounce-sub-drop.mp3",
};

const app = {
  ctx: null,
  buffers: {},
  drumBuffers: {},
  notaAtiva: null,
  padSrc: null,
  padGain: null,
  padMaster: null,
  drumMaster: null,
  compressor: null,
  padsMuted: false,
  drumsMuted: false,
  padsSolo: false,
  drumsSolo: false,
};

/* ================= LOADER ================= */

function updateProgress() {
  const pct = (LOADED / TOTAL) * 100;
  document.getElementById("progress-fill").style.width = pct + "%";
}

function finishLoading() {
  const elapsed = Date.now() - loadStart;
  const remaining = MIN_LOAD_TIME - elapsed;

  setTimeout(
    () => {
      const loader = document.getElementById("loader-screen");
      const appEl = document.getElementById("app");

      loader.style.opacity = 0;

      setTimeout(() => {
        loader.remove();
        appEl.removeAttribute("hidden");
        appEl.classList.add("app-enter");
      }, 500);
    },
    remaining > 0 ? remaining : 0,
  );
}

/* ================= AUDIO INIT (iOS FIX) ================= */

function initAudio() {
  if (audioInitialized) return;

  app.ctx = new (window.AudioContext || window.webkitAudioContext)();

  app.padMaster = app.ctx.createGain();
  app.drumMaster = app.ctx.createGain();
  app.compressor = app.ctx.createDynamicsCompressor();

  app.compressor.threshold.value = -18;
  app.compressor.knee.value = 30;
  app.compressor.ratio.value = 4;
  app.compressor.attack.value = 0.003;
  app.compressor.release.value = 0.25;

  app.padMaster.connect(app.compressor);
  app.drumMaster.connect(app.compressor);
  app.compressor.connect(app.ctx.destination);

  updatePadsVolume();
  updateDrumsVolume();

  audioInitialized = true;
}

/* ================= VOLUME ================= */

function updatePadsVolume() {
  if (!app.padMaster) return;

  if (app.padsMuted || (app.drumsSolo && !app.padsSolo)) {
    app.padMaster.gain.value = 0;
  } else {
    app.padMaster.gain.value = padsMasterVolume * padsMasterVolume;
  }
}

function updateDrumsVolume() {
  if (!app.drumMaster) return;

  if (app.drumsMuted || (app.padsSolo && !app.drumsSolo)) {
    app.drumMaster.gain.value = 0;
  } else {
    app.drumMaster.gain.value = drumsMasterVolume * drumsMasterVolume;
  }
}

/* ================= PRELOAD ================= */

async function fetchDecode(path) {
  const r = await fetch(path);
  const b = await r.arrayBuffer();
  return await app.ctx.decodeAudioData(b);
}

async function preload(entries, base, store) {
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const slice = entries.slice(i, i + CONCURRENCY);

    await Promise.all(
      slice.map(async ([k, file]) => {
        try {
          store[k] = await fetchDecode(base + file);
        } catch (e) {
          console.warn("Erro:", file);
        }
        LOADED++;
        updateProgress();
      }),
    );
  }
}

/* ================= PAD ================= */

function playPad(nota) {
  if (!audioInitialized) return;

  const buf = app.buffers[nota];
  if (!buf) return;

  const now = app.ctx.currentTime;

  // clicar no mesmo → parar
  if (app.notaAtiva === nota) {
    app.padGain.gain.linearRampToValueAtTime(0, now + PAD_FADE_TIME);
    app.padSrc.stop(now + PAD_FADE_TIME);

    app.notaAtiva = null;
    document
      .querySelectorAll(".tecla.ativa")
      .forEach((el) => el.classList.remove("ativa"));
    return;
  }

  const newSrc = app.ctx.createBufferSource();
  const newGain = app.ctx.createGain();

  newSrc.buffer = buf;
  newSrc.loop = true;

  newGain.gain.setValueAtTime(0, now);
  newGain.gain.linearRampToValueAtTime(0.75, now + PAD_FADE_TIME);

  newSrc.connect(newGain).connect(app.padMaster);
  newSrc.start();

  if (app.padSrc) {
    app.padGain.gain.linearRampToValueAtTime(0, now + PAD_FADE_TIME);
    app.padSrc.stop(now + PAD_FADE_TIME);
  }

  app.padSrc = newSrc;
  app.padGain = newGain;
  app.notaAtiva = nota;

  document
    .querySelectorAll(".tecla.ativa")
    .forEach((el) => el.classList.remove("ativa"));

  document.querySelector(`[data-nota="${nota}"]`)?.classList.add("ativa");
}

/* ================= DRUM ================= */

function playDrum(k) {
  if (!audioInitialized) return;

  const buf = app.drumBuffers[k];
  if (!buf) return;

  const s = app.ctx.createBufferSource();
  s.buffer = buf;
  s.connect(app.drumMaster);
  s.start();

  const el = document.querySelector(`[data-drum="${k}"]`);
  el?.classList.add("ativa");
  setTimeout(() => el?.classList.remove("ativa"), 150);
}

/* ================= EVENTS ================= */

function bindEvents() {
  document.body.addEventListener(
    "click",
    () => {
      initAudio();
    },
    { once: true },
  );

  document.getElementById("pads").addEventListener("click", (e) => {
    const b = e.target.closest("[data-nota]");
    if (!b) return;
    playPad(b.dataset.nota);
  });

  document.getElementById("drums").addEventListener("click", (e) => {
    const b = e.target.closest("[data-drum]");
    if (!b) return;
    playDrum(b.dataset.drum);
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (DRUM_FILES[k]) playDrum(k);
  });

  document.getElementById("padsVolume").addEventListener("input", (e) => {
    padsMasterVolume = parseFloat(e.target.value);
    updatePadsVolume();
  });

  document.getElementById("drumsVolume").addEventListener("input", (e) => {
    drumsMasterVolume = parseFloat(e.target.value);
    updateDrumsVolume();
  });
}

/* ================= INIT ================= */

async function init() {
  loadStart = Date.now();

  // criar ctx temporária só para decode (iOS precisa depois de gesto)
  app.ctx = new (window.AudioContext || window.webkitAudioContext)();

  const padEntries = Object.entries(PAD_FILES);
  const drumEntries = Object.entries(DRUM_FILES);

  TOTAL = padEntries.length + drumEntries.length;

  await preload(padEntries, "./sons/", app.buffers);
  await preload(drumEntries, "./sons/DRUM/", app.drumBuffers);

  finishLoading();
  bindEvents();
}

init();
