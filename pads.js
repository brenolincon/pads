"use strict";

// Mapeamento de todos os sons disponíveis
const SONS_DISPONIVEIS = {
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

// Estado centralizado
const app = {
  notaAtiva: null,
  audios: {},
  container: document.getElementById("conteudo"),
};

// Carrega todos os áudios em cache
const carregarAudios = () => {
  Object.entries(SONS_DISPONIVEIS).forEach(([nota, arquivo]) => {
    const audio = new Audio(`./sons/${arquivo}`);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.7;
    app.audios[nota] = audio;
  });
};

// Converte nota para ID seguro (remove caracteres especiais)
const notaParaId = (nota) => {
  return nota.replace("#", "s");
};

// Cria o botão de um pad
const criarBotao = (nota) => {
  const botao = document.createElement("button");
  botao.classList.add("tecla");
  botao.textContent = nota;
  botao.id = `pad-${notaParaId(nota)}`;
  botao.title = `Pad ${nota}`;
  botao.addEventListener("click", () => alternarNota(nota));
  botao.addEventListener("touchstart", (e) => {
    e.preventDefault();
    alternarNota(nota);
  });
  return botao;
};

// Renderiza todos os pads
const renderizar = () => {
  Object.keys(SONS_DISPONIVEIS).forEach((nota) => {
    app.container.appendChild(criarBotao(nota));
  });
};

// Para a nota ativa e remove a classe visual
const pararAtivo = () => {
  if (app.notaAtiva) {
    const audio = app.audios[app.notaAtiva];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    const elemento = document.getElementById(
      `pad-${notaParaId(app.notaAtiva)}`,
    );
    if (elemento) {
      elemento.classList.remove("ativa");
    }
    app.notaAtiva = null;
  }
};

// Alterna play/pause de uma nota
const alternarNota = (nota) => {
  if (app.notaAtiva === nota) {
    // Nota ativa - para
    pararAtivo();
  } else {
    // Nova nota - para a anterior e toca a nova
    pararAtivo();
    const audio = app.audios[nota];
    if (audio) {
      audio.currentTime = 0;
      audio
        .play()
        .catch((erro) => console.warn(`Erro ao tocar ${nota}:`, erro));
    }

    app.notaAtiva = nota;
    const elemento = document.getElementById(`pad-${notaParaId(nota)}`);
    if (elemento) {
      elemento.classList.add("ativa");
    }
  }
};

// Inicializa a aplicação
const inicializar = () => {
  carregarAudios();
  renderizar();

  window.addEventListener("blur", pararAtivo);

  console.log("🎹 AMBIENT PADS iniciado com sucesso!");
};

// Inicia quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}
