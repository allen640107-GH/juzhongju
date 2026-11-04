import { colorOfPlayer } from "./banqi.js";
import {
  banqiTargets,
  hintMove,
  hydrate,
  isAiTurn,
  newDark,
  newXiangqi,
  playBanqi,
  playXiangqi,
  sealText,
  serialize,
  think,
  turnText,
  undoTurn,
  xiangqiTargets,
} from "./game.js";
import { createStage } from "./scene.js";
import { playCue, setSoundEnabled } from "./sound.js";
import { C, RED, pieceSide, pieceType } from "./xiangqi.js";

const SAVE_KEY = "juzhongju-v1";
const SOUND_KEY = "juzhongju-sound";
const VIEW_KEY = "juzhongju-view";

const statusEl = document.querySelector("#status");
const hintEl = document.querySelector("#hintline");
const recordEl = document.querySelector("#record");
const sealEl = document.querySelector("#seal");
const continueBtn = document.querySelector("#btn-continue");
const canvas = document.querySelector("#board");

let state = null;
let selected = null;
let hintNote = "";
let busy = false;
let thinkGen = 0;
let silence = false;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 直接開檔時，有些瀏覽器不讓寫入。 */
  }
}

let soundOn = storageGet(SOUND_KEY) !== "0";

function viewPrefs() {
  try {
    return JSON.parse(storageGet(VIEW_KEY) || "{}");
  } catch {
    return {};
  }
}

const prefs = viewPrefs();
const optLabel = document.querySelector("#opt-label");
const optCloseup = document.querySelector("#opt-closeup");
const optFast = document.querySelector("#opt-fast");
const optLite = document.querySelector("#opt-lite");
const optSpin = document.querySelector("#opt-spin");
optLabel.checked = prefs.labelStyle === 3 ? prefs.labels !== false : true;
optCloseup.checked = prefs.closeup !== false;
optFast.checked = !!prefs.fast;
optLite.checked = !!prefs.lite;
optSpin.checked = !!prefs.spin;

function savePrefs() {
  storageSet(
    VIEW_KEY,
    JSON.stringify({
      labels: optLabel.checked,
      labelStyle: 3,
      closeup: optCloseup.checked,
      fast: optFast.checked,
      lite: optLite.checked,
      spin: optSpin.checked,
    }),
  );
}

function options() {
  return {
    mode: document.querySelector("input[name=mode]:checked").value,
    vs: document.querySelector("input[name=vs]:checked").value,
    level: Number(document.querySelector("input[name=level]:checked").value),
    humanSide: Number(document.querySelector("input[name=side]:checked").value),
  };
}

function makeMatch() {
  const opt = options();
  if (opt.mode === "banqi") return newDark({ vs: opt.vs, level: opt.level });
  return newXiangqi({ vs: opt.vs, level: opt.level, humanSide: opt.humanSide });
}

function targetsOf(index) {
  if (state.mode === "xiangqi") return xiangqiTargets(state, index);
  return banqiTargets(state, index);
}

function occupied(index) {
  if (state.mode === "xiangqi") return state.board[index] !== 0;
  return state.banqi.pieces[index] !== 0;
}

let stage = null;
statusEl.textContent = "棋子就位中";

function applyViewOptions() {
  if (!stage) return;
  stage.setLabels(optLabel.checked);
  stage.setCloseup(optCloseup.checked);
  stage.setSpeed(optFast.checked ? 1.8 : 1);
  stage.setQuality(!optLite.checked);
  savePrefs();
}

function begin(next) {
  if (!stage) return;
  thinkGen += 1;
  busy = false;
  selected = null;
  hintNote = "";
  state = next;
  document.body.dataset.mode = state.mode;
  stage.layout(state);
  const seat = state.mode === "xiangqi" ? state.humanSide : RED;
  stage.faceSide(state.vs === "human" ? RED : seat, true);
  render();
  scheduleAi();
}

function persist() {
  storageSet(SAVE_KEY, JSON.stringify(serialize(state)));
  continueBtn.hidden = !storageGet(SAVE_KEY);
}

function motionFrom(board, from, to) {
  const attacker = board[from];
  const captured = board[to] !== 0;
  return {
    from,
    to,
    capture: captured,
    cannon: pieceType(attacker) === C && captured,
    type: pieceType(attacker),
  };
}

function render() {
  stage.showGuides({
    selected,
    targets: selected == null ? [] : targetsOf(selected),
    last: state.last,
    hint: state.hint,
    occupied,
  });
  statusEl.textContent = busy && isAiTurn(state) ? "思考中" : turnText(state);
  hintEl.textContent = hintNote ? `提示：${hintNote}` : "";
  const seal = sealText(state);
  sealEl.hidden = !seal;
  sealEl.textContent = seal || "";
  recordEl.innerHTML = state.record
    .map((note, i) => {
      const tag = state.mode === "xiangqi" ? (i % 2 === 0 ? "紅" : "黑") : i % 2 === 0 ? "先" : "後";
      return `<li><span>${tag}</span>${note}</li>`;
    })
    .join("");
  recordEl.scrollTop = recordEl.scrollHeight;
  document.querySelector("#btn-undo").disabled = busy || state.past.length === 0;
  document.querySelector("#btn-hint").disabled = busy || !!state.over || isAiTurn(state);
  document.querySelector("#btn-sound").textContent = soundOn ? "音效開" : "音效關";
}

function onPick(index) {
  if (busy || state.over || isAiTurn(state)) return;
  if (state.mode === "xiangqi") pickXiangqi(index);
  else pickBanqi(index);
}

function canDrag(index) {
  if (!state || busy || state.over || isAiTurn(state) || state.mode !== "xiangqi") return false;
  return pieceSide(state.board[index]) === state.side;
}

function canDrop(from, to) {
  if (!state || busy || state.over || isAiTurn(state) || state.mode !== "xiangqi") return false;
  return xiangqiTargets(state, from).includes(to);
}

function commitDrag(from, to) {
  selected = from;
  pickXiangqi(to);
}

function pickXiangqi(index) {
  if (selected != null && targetsOf(selected).includes(index)) {
    const from = selected;
    const motion = motionFrom(state.board, from, index);
    playXiangqi(state, from, index);
    selected = null;
    hintNote = "";
    afterHuman(motion);
    return;
  }
  if (pieceSide(state.board[index]) === state.side) {
    selected = index;
    hintNote = "";
    render();
    return;
  }
  selected = null;
  render();
}

function pickBanqi(index) {
  if (selected != null && targetsOf(selected).includes(index)) {
    const from = selected;
    const motion = motionFrom(state.banqi.pieces, from, index);
    playBanqi(state, { kind: "move", from, to: index });
    selected = null;
    hintNote = "";
    afterHuman(motion);
    return;
  }
  if (state.banqi.face[index] === 1) {
    playBanqi(state, { kind: "flip", index });
    selected = null;
    hintNote = "";
    afterHuman({ flip: index });
    return;
  }
  const owner = colorOfPlayer(state.banqi, state.banqi.turn);
  if (state.banqi.face[index] === 2 && pieceSide(state.banqi.pieces[index]) === owner) {
    selected = index;
    render();
    return;
  }
  selected = null;
  render();
}

function afterHuman(motion) {
  const gen = thinkGen;
  busy = true;
  render();
  const done = () => {
    if (gen !== thinkGen) return;
    busy = false;
    persist();
    render();
    if (optSpin.checked && state.vs === "human" && state.mode === "xiangqi" && !state.over) {
      stage.faceSide(state.side, false);
    }
    scheduleAi();
  };
  const run = motion.flip != null ? stage.flip(motion.flip).then(() => stage.layout(state)) : stage.relocate(motion);
  run.then(done);
}

function scheduleAi() {
  if (busy || !isAiTurn(state)) return;
  const gen = ++thinkGen;
  busy = true;
  render();
  setTimeout(() => {
    if (gen !== thinkGen) return;
    const move = think(state);
    if (!move) {
      busy = false;
      render();
      return;
    }
    let motion;
    if (state.mode === "xiangqi") {
      motion = motionFrom(state.board, move.from, move.to);
      playXiangqi(state, move.from, move.to);
    } else if (move.kind === "flip") {
      motion = { flip: move.index };
      playBanqi(state, move);
    } else {
      motion = motionFrom(state.banqi.pieces, move.from, move.to);
      playBanqi(state, move);
    }
    const run = motion.flip != null ? stage.flip(motion.flip).then(() => stage.layout(state)) : stage.relocate(motion);
    run.then(() => {
      if (gen !== thinkGen) return;
      busy = false;
      persist();
      render();
      scheduleAi();
    });
  }, 40);
}

document.querySelectorAll("input[name]").forEach((input) => {
  input.addEventListener("change", () => {
    if (silence) return;
    if (input.name === "level" && state) {
      state.level = Number(input.value);
      return;
    }
    begin(makeMatch());
  });
});

for (const box of [optLabel, optCloseup, optFast, optLite, optSpin]) {
  box.addEventListener("change", applyViewOptions);
}

document.querySelector("#btn-new").addEventListener("click", () => begin(makeMatch()));
document.querySelector("#btn-undo").addEventListener("click", () => {
  if (busy) return;
  undoTurn(state);
  selected = null;
  hintNote = "";
  stage.layout(state);
  persist();
  render();
  scheduleAi();
});
document.querySelector("#btn-hint").addEventListener("click", () => {
  if (busy || state.over || isAiTurn(state)) return;
  const gen = ++thinkGen;
  busy = true;
  render();
  setTimeout(() => {
    if (gen !== thinkGen) return;
    const hinted = hintMove(state);
    hintNote = hinted ? hinted.note : "";
    if (hinted?.move?.from != null) selected = hinted.move.from;
    else if (hinted?.move?.index != null) selected = null;
    busy = false;
    render();
  }, 30);
});
document.querySelector("#btn-view").addEventListener("click", () => stage.resetView());
function openTable() {
  const titleEl = document.querySelector("#title");
  if (!titleEl || titleEl.hidden) {
    document.body.dataset.playing = "1";
    return;
  }
  titleEl.classList.add("leaving");
  document.body.dataset.playing = "1";
  window.setTimeout(() => {
    titleEl.hidden = true;
  }, 460);
}
document.querySelector("#title-start").addEventListener("click", () => {
  silence = true;
  document.querySelector('input[name=mode][value="xiangqi"]').checked = true;
  silence = false;
  openTable();
  begin(makeMatch());
});
document.querySelector("#title-dark").addEventListener("click", () => {
  silence = true;
  document.querySelector('input[name=mode][value="banqi"]').checked = true;
  silence = false;
  openTable();
  begin(makeMatch());
});
document.querySelector("#title-resume").addEventListener("click", () => {
  openTable();
  continueBtn.click();
});
continueBtn.addEventListener("click", () => {
  try {
    const next = hydrate(JSON.parse(storageGet(SAVE_KEY) || "null"));
    if (!next) return;
    applyOptionsFrom(next);
    begin(next);
  } catch {
    continueBtn.hidden = true;
  }
});
document.querySelector("#btn-sound").addEventListener("click", () => {
  soundOn = !soundOn;
  storageSet(SOUND_KEY, soundOn ? "1" : "0");
  setSoundEnabled(soundOn);
  render();
});
document.querySelector("#btn-rules").addEventListener("click", () => {
  document.querySelector("#rules").showModal();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    selected = null;
    render();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    event.preventDefault();
    document.querySelector("#btn-undo").click();
  }
});

function applyOptionsFrom(next) {
  silence = true;
  document.querySelector(`input[name=mode][value="${next.mode}"]`).checked = true;
  document.querySelector(`input[name=vs][value="${next.vs}"]`).checked = true;
  document.querySelector(`input[name=level][value="${next.level}"]`).checked = true;
  if (next.mode === "xiangqi") {
    document.querySelector(`input[name=side][value="${next.humanSide}"]`).checked = true;
  }
  silence = false;
}

Promise.resolve()
  .then(() => createStage(canvas, { onPick, onCue: playCue, canDrag, canDrop, commitDrag }))
  .then((ready) => {
    stage = ready;
    setSoundEnabled(soundOn);
    if (new URLSearchParams(location.search).has("test")) {
      window.__juzhong = {
        projectIndex: (index) => stage.projectIndex(index),
        projectSquare: (file, rank) => stage.projectSquare(file, rank),
        boardInside: () => stage.boardInside(),
        debugFrame: () => stage.debugFrame(),
      };
    }
    stage.setLabels(optLabel.checked);
    stage.setCloseup(optCloseup.checked);
    stage.setSpeed(optFast.checked ? 1.8 : 1);
    stage.setQuality(!optLite.checked);
    const saved = !!storageGet(SAVE_KEY);
    continueBtn.hidden = !saved;
    const titleResume = document.querySelector("#title-resume");
    if (titleResume) titleResume.hidden = !saved;
    const params = new URLSearchParams(location.search);
    if (params.has("test") || params.has("play")) {
      document.querySelector("#title").hidden = true;
      document.body.dataset.playing = "1";
      begin(makeMatch());
    }
    document.body.dataset.ready = "1";
    document.getElementById("boot-warn").hidden = true;
  })
  .catch((error) => {
    console.error(error);
    const warn = document.getElementById("boot-warn");
    warn.hidden = false;
    warn.textContent = "畫面沒有載入。請重新雙擊啟動.bat。";
  });
