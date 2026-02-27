"use strict";

/* ================= CONFIG ================= */

let padsMasterVolume = 1;
let drumsMasterVolume = 1;

const PAD_FADE_TIME = 0.4; // 400ms

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
  padsMuted: false,
  drumsMuted: false,
  padsSolo: false,
  drumsSolo: false,
  compressor: null,
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

function togglePadsMute() {
  app.padsMuted = !app.padsMuted;
  updatePadsVolume();
}

function toggleDrumsMute() {
  app.drumsMuted = !app.drumsMuted;
  updateDrumsVolume();
}

function togglePadsSolo() {
  app.padsSolo = !app.padsSolo;
  updatePadsVolume();
  updateDrumsVolume();
}

function toggleDrumsSolo() {
  app.drumsSolo = !app.drumsSolo;
  updatePadsVolume();
  updateDrumsVolume();
}

/* ================= PAD ================= */

function stopPad() {
  if (!app.padSrc) return;

  try {
    app.padSrc.stop();
  } catch {}
  try {
    app.padSrc.disconnect();
  } catch {}
  try {
    app.padGain.disconnect();
  } catch {}

  app.padSrc = null;
  app.padGain = null;
  app.notaAtiva = null;

  document
    .querySelectorAll(".tecla.ativa")
    .forEach((el) => el.classList.remove("ativa"));
}

function playPad(nota) {
  const buf = app.buffers[nota];
  if (!buf) return;

  const now = app.ctx.currentTime;

  // ===== SE CLICAR NO MESMO PAD → PARAR =====
  if (app.notaAtiva === nota) {
    if (app.padSrc) {
      app.padGain.gain.cancelScheduledValues(now);
      app.padGain.gain.setValueAtTime(app.padGain.gain.value, now);
      app.padGain.gain.linearRampToValueAtTime(0, now + PAD_FADE_TIME);

      app.padSrc.stop(now + PAD_FADE_TIME);

      setTimeout(() => {
        try {
          app.padSrc.disconnect();
        } catch {}
        try {
          app.padGain.disconnect();
        } catch {}
      }, PAD_FADE_TIME * 1000);
    }

    app.padSrc = null;
    app.padGain = null;
    app.notaAtiva = null;

    document
      .querySelectorAll(".tecla.ativa")
      .forEach((el) => el.classList.remove("ativa"));

    return;
  }

  // ===== NOVO PAD (CROSSFADE) =====
  const newSrc = app.ctx.createBufferSource();
  const newGain = app.ctx.createGain();

  newSrc.buffer = buf;
  newSrc.loop = true;

  newGain.gain.setValueAtTime(0, now);
  newGain.gain.linearRampToValueAtTime(0.75, now + PAD_FADE_TIME);

  newSrc.connect(newGain).connect(app.padMaster);
  newSrc.start(now);

  // ===== PAD ANTIGO =====
  if (app.padSrc) {
    const oldSrc = app.padSrc;
    const oldGain = app.padGain;

    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(oldGain.gain.value, now);
    oldGain.gain.linearRampToValueAtTime(0, now + PAD_FADE_TIME);

    oldSrc.stop(now + PAD_FADE_TIME);

    setTimeout(() => {
      try {
        oldSrc.disconnect();
      } catch {}
      try {
        oldGain.disconnect();
      } catch {}
    }, PAD_FADE_TIME * 1000);
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

  document.getElementById("padsMute").addEventListener("click", (e) => {
    togglePadsMute();
    e.target.classList.toggle("active");
  });

  document.getElementById("drumsMute").addEventListener("click", (e) => {
    toggleDrumsMute();
    e.target.classList.toggle("active");
  });

  document.getElementById("padsSolo").addEventListener("click", (e) => {
    togglePadsSolo();
    e.target.classList.toggle("active");
  });

  document.getElementById("drumsSolo").addEventListener("click", (e) => {
    toggleDrumsSolo();
    e.target.classList.toggle("active");
  });
}

/* ================= INIT ================= */

async function init() {
  loadStart = Date.now();

  app.ctx = new (window.AudioContext || window.webkitAudioContext)();

  app.padMaster = app.ctx.createGain();
  app.drumMaster = app.ctx.createGain();
  app.compressor = app.ctx.createDynamicsCompressor();

  app.padMaster.gain.value = padsMasterVolume;
  app.drumMaster.gain.value = drumsMasterVolume;

  app.padMaster.connect(app.compressor);
  app.drumMaster.connect(app.compressor);
  app.compressor.connect(app.ctx.destination);

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
