"use strict";

/* ================= CONFIG ================= */

let padsMasterVolume = 1;
let drumsMasterVolume = 1;

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

const MIN_LOAD_TIME = 1500;
const CONCURRENCY = 3;

let TOTAL = 0;
let LOADED = 0;
let loadStart = 0;

const app = {
  ctx: null,
  buffers: {},
  drumBuffers: {},
  notaAtiva: null,
  padSrc: null,
  padGain: null,
  padMaster: null,
  drumMaster: null,
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

/* ================= AUDIO ================= */

function updatePadsVolume() {
  if (app.padMaster) {
    app.padMaster.gain.value = padsMasterVolume * padsMasterVolume;
  }
}

function updateDrumsVolume() {
  if (app.drumMaster) {
    app.drumMaster.gain.value = drumsMasterVolume * drumsMasterVolume;
  }
}

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

function stopPad() {
  if (app.padSrc) {
    try {
      app.padSrc.stop();
    } catch {}
    app.padSrc.disconnect();
    app.padGain.disconnect();
  }

  document
    .querySelectorAll(".tecla.ativa")
    .forEach((el) => el.classList.remove("ativa"));

  app.padSrc = null;
  app.notaAtiva = null;
}

function playPad(nota) {
  if (app.notaAtiva === nota) {
    stopPad();
    return;
  }

  stopPad();

  const buf = app.buffers[nota];
  if (!buf) return;

  const src = app.ctx.createBufferSource();
  const gain = app.ctx.createGain();

  gain.gain.value = 0.75;

  src.buffer = buf;
  src.loop = true;

  src.connect(gain).connect(app.padMaster);
  src.start();

  app.padSrc = src;
  app.padGain = gain;
  app.notaAtiva = nota;

  document.querySelector(`[data-nota="${nota}"]`)?.classList.add("ativa");
}

/* ================= DRUM ================= */

function playDrum(k) {
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
  document.getElementById("pads").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-nota]");
    if (!b) return;
    await app.ctx.resume();
    playPad(b.dataset.nota);
  });

  document.getElementById("drums").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-drum]");
    if (!b) return;
    await app.ctx.resume();
    playDrum(b.dataset.drum);
  });

  window.addEventListener("keydown", async (e) => {
    const k = e.key.toLowerCase();
    if (DRUM_FILES[k]) {
      await app.ctx.resume();
      playDrum(k);
    }
  });

  window.addEventListener("blur", stopPad);

  /* FADERS */
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

  app.ctx = new (window.AudioContext || window.webkitAudioContext)();

  /* MASTER GAINS */
  app.padMaster = app.ctx.createGain();
  app.drumMaster = app.ctx.createGain();

  app.padMaster.gain.value = padsMasterVolume;
  app.drumMaster.gain.value = drumsMasterVolume;

  app.padMaster.connect(app.ctx.destination);
  app.drumMaster.connect(app.ctx.destination);

  const padEntries = Object.entries(PAD_FILES);
  const drumEntries = Object.entries(DRUM_FILES);

  TOTAL = padEntries.length + drumEntries.length;

  await preload(padEntries, "./sons/", app.buffers);
  await preload(drumEntries, "./sons/DRUM/", app.drumBuffers);

  finishLoading();
  bindEvents();
}

init();
