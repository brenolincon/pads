"use strict";

// Mapeamento de todos os sons disponíveis (pads)
const SONS_DISPONIVEIS = {
  A: "A Pad.wav",
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

// Mapeamento dos sons de drum (teclas do teclado em minúsculo)
const DRUM_SOUNDS = {
  a: "OPTN SNARE 1.mp3",
  s: "DIGITAL TOM 3.wav",
  d: "Bethel Tambourine.mp3",
  f: "SOFT TAMBO DRY I(1).mp3",
  g: "CLANK VERB.wav",
  h: "melbournebounce-sub-drop.mp3",
};

// Estado centralizado usando WebAudio
const app = {
  notaAtiva: null,
  container: document.getElementById("conteudo"),
  drumContainer: document.getElementById("drum-conteudo"),
  audioCtx: null,
  padsBuffers: {},
  drumBuffers: {},
  padSource: null,
  padGain: null,
  usingLegacy: false,
  legacyAudios: {},
  legacyDrumMap: {},
};

// Converte nota para ID seguro (remove caracteres especiais)
const notaParaId = (nota) => nota.replace("#", "s");

// Carrega e decodifica buffers de pads
const carregarAudios = async () => {
  const entries = Object.entries(SONS_DISPONIVEIS);
  try {
    await Promise.all(
      entries.map(async ([nota, arquivo]) => {
        const resp = await fetch(`./sons/${arquivo}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        // decodeAudioData may or may not return a promise depending on browser
        const buffer = await (async () => {
          try {
            return await app.audioCtx.decodeAudioData(arrayBuffer);
          } catch (e) {
            // Some implementations require callback style
            return await new Promise((resolve, reject) =>
              app.audioCtx.decodeAudioData(arrayBuffer, resolve, reject),
            );
          }
        })();
        app.padsBuffers[nota] = buffer;
      }),
    );
  } catch (err) {
    console.warn(
      "Falha no carregamento via fetch/decode — usando fallback HTMLAudio:",
      err,
    );
    app.usingLegacy = true;
    carregarAudiosLegacy();
  }
};

// Fallback usando HTMLAudio (útil ao abrir via file:// ou quando fetch/decode falham)
const carregarAudiosLegacy = () => {
  Object.entries(SONS_DISPONIVEIS).forEach(([nota, arquivo]) => {
    const audio = new Audio(`./sons/${arquivo}`);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.7;
    app.legacyAudios[nota] = audio;
  });
};

// Carrega e decodifica buffers de drums
const carregarDrumBuffers = async () => {
  const entries = Object.entries(DRUM_SOUNDS);
  try {
    await Promise.all(
      entries.map(async ([tecla, arquivo]) => {
        const resp = await fetch(`./sons/DRUM/${arquivo}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = await (async () => {
          try {
            return await app.audioCtx.decodeAudioData(arrayBuffer);
          } catch (e) {
            return await new Promise((resolve, reject) =>
              app.audioCtx.decodeAudioData(arrayBuffer, resolve, reject),
            );
          }
        })();
        app.drumBuffers[tecla] = buffer;
      }),
    );
  } catch (err) {
    console.warn(
      "Falha no carregamento de drums via fetch/decode — usando fallback HTMLAudio:",
      err,
    );
    app.usingLegacy = true;
    carregarDrumPathsLegacy();
  }
};

const carregarDrumPathsLegacy = () => {
  Object.entries(DRUM_SOUNDS).forEach(([tecla, arquivo]) => {
    app.legacyDrumMap[tecla] = `./sons/DRUM/${arquivo}`;
  });
};

// Cria o botão de um pad
const criarBotao = (nota) => {
  const botao = document.createElement("button");
  botao.classList.add("tecla");
  botao.textContent = nota;
  botao.id = `pad-${notaParaId(nota)}`;
  botao.title = `Pad ${nota}`;
  botao.addEventListener("click", async () => {
    if (app.audioCtx && app.audioCtx.state === "suspended")
      await app.audioCtx.resume();
    alternarNota(nota);
  });
  botao.addEventListener("touchstart", async (e) => {
    e.preventDefault();
    if (app.audioCtx && app.audioCtx.state === "suspended")
      await app.audioCtx.resume();
    alternarNota(nota);
  });
  return botao;
};

// Cria botão visual para drum
const criarBotaoDrum = (tecla, arquivo) => {
  const botao = document.createElement("button");
  botao.classList.add("tecla");
  botao.textContent = tecla.toUpperCase();
  botao.id = `drum-${tecla}`;
  botao.title = `${tecla.toUpperCase()} — ${arquivo}`;
  botao.addEventListener("click", async () => {
    if (app.audioCtx && app.audioCtx.state === "suspended")
      await app.audioCtx.resume();
    tocarDrum(tecla);
  });
  botao.addEventListener("touchstart", async (e) => {
    e.preventDefault();
    if (app.audioCtx && app.audioCtx.state === "suspended")
      await app.audioCtx.resume();
    tocarDrum(tecla);
  });
  return botao;
};

// Renderiza todos os pads
const renderizar = () => {
  Object.keys(SONS_DISPONIVEIS).forEach((nota) => {
    app.container.appendChild(criarBotao(nota));
  });
};

// Renderiza botões de drum
const renderizarDrums = () => {
  if (!app.drumContainer) return;
  Object.entries(DRUM_SOUNDS).forEach(([tecla, arquivo]) => {
    app.drumContainer.appendChild(criarBotaoDrum(tecla, arquivo));
  });
};

// Para a nota ativa e remove a classe visual
const pararAtivo = () => {
  if (app.notaAtiva) {
    if (app.padSource) {
      try {
        app.padSource.stop();
      } catch (e) {
        // ignore
      }
      app.padSource.disconnect();
      app.padGain.disconnect();
      app.padSource = null;
      app.padGain = null;
    }
    const elemento = document.getElementById(
      `pad-${notaParaId(app.notaAtiva)}`,
    );
    if (elemento) elemento.classList.remove("ativa");
    app.notaAtiva = null;
  }
};

// Alterna play/pause de uma nota (usa BufferSource em loop)
const alternarNota = (nota) => {
  if (app.usingLegacy) {
    // Fallback para HTMLAudio
    if (app.notaAtiva === nota) {
      if (app.legacyAudios[nota]) {
        app.legacyAudios[nota].pause();
        app.legacyAudios[nota].currentTime = 0;
      }
      const elementoAtivo = document.getElementById(
        `pad-${notaParaId(app.notaAtiva)}`,
      );
      if (elementoAtivo) elementoAtivo.classList.remove("ativa");
      app.notaAtiva = null;
      return;
    }

    // Toca nova nota com HTMLAudio
    if (app.notaAtiva && app.legacyAudios[app.notaAtiva]) {
      app.legacyAudios[app.notaAtiva].pause();
      app.legacyAudios[app.notaAtiva].currentTime = 0;
      const elementoAtivo = document.getElementById(
        `pad-${notaParaId(app.notaAtiva)}`,
      );
      if (elementoAtivo) elementoAtivo.classList.remove("ativa");
    }

    const audio = app.legacyAudios[nota];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch((err) => console.warn("Erro ao tocar (legacy):", err));
    }
    app.notaAtiva = nota;
    const elemento = document.getElementById(`pad-${notaParaId(nota)}`);
    if (elemento) elemento.classList.add("ativa");
    return;
  }

  if (app.notaAtiva === nota) {
    pararAtivo();
    return;
  }

  // Toca nova nota usando WebAudio
  pararAtivo();
  const buffer = app.padsBuffers[nota];
  if (!buffer) {
    console.warn(`Buffer não carregado para nota ${nota}`);
    return;
  }
  const src = app.audioCtx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = app.audioCtx.createGain();
  gain.gain.value = 0.7;
  src.connect(gain).connect(app.audioCtx.destination);
  src.start(0);

  app.padSource = src;
  app.padGain = gain;
  app.notaAtiva = nota;
  const elemento = document.getElementById(`pad-${notaParaId(nota)}`);
  if (elemento) elemento.classList.add("ativa");
};

// Toca um som de drum usando BufferSource (permite sobreposição)
const tocarDrum = (tecla) => {
  if (app.usingLegacy) {
    const caminho = app.legacyDrumMap[tecla];
    if (!caminho) return;
    try {
      const audio = new Audio(caminho);
      audio.preload = "auto";
      audio.volume = 0.9;
      audio
        .play()
        .catch((err) => console.warn("Erro ao tocar drum (legacy):", err));
    } catch (err) {
      console.warn("Falha ao instanciar Audio para drum (legacy):", err);
    }
    const elemento = document.getElementById(`drum-${tecla}`);
    if (elemento) {
      elemento.classList.add("ativa");
      setTimeout(() => elemento.classList.remove("ativa"), 150);
    }
    return;
  }

  const buffer = app.drumBuffers[tecla];
  if (!buffer) return;
  const src = app.audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = app.audioCtx.createGain();
  gain.gain.value = 0.95;
  src.connect(gain).connect(app.audioCtx.destination);
  src.start(0);
  src.onended = () => {
    try {
      src.disconnect();
      gain.disconnect();
    } catch (e) {
      // ignore
    }
  };

  const elemento = document.getElementById(`drum-${tecla}`);
  if (elemento) {
    elemento.classList.add("ativa");
    setTimeout(() => elemento.classList.remove("ativa"), 150);
  }
};

// Inicializa a aplicação (cria AudioContext e carrega buffers)
const inicializar = async () => {
  try {
    app.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (err) {
    console.warn("WebAudio não suportado:", err);
  }

  if (app.audioCtx) {
    await carregarAudios();
    await carregarDrumBuffers();
  }

  renderizar();
  renderizarDrums();

  window.addEventListener("blur", pararAtivo);

  // Mapeamento de teclado para drums (suporta WebAudio e fallback legacy)
  window.addEventListener("keydown", async (e) => {
    const k = e.key.toLowerCase();

    // Legacy (HTMLAudio) mode
    if (app.usingLegacy) {
      if (app.legacyDrumMap[k]) {
        tocarDrum(k);
      }
      return;
    }

    // WebAudio mode
    if (!app.audioCtx) return;
    if (app.audioCtx.state === "suspended") await app.audioCtx.resume();
    if (app.drumBuffers[k]) {
      tocarDrum(k);
    }
  });

  console.log("🎹 AMBIENT PADS iniciado com WebAudio!");
};

// Inicia quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => inicializar());
} else {
  inicializar();
}
