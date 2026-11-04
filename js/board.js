/**
 * 棋盤畫面。象棋交給 xiangqiboard.js（MIT，vendor/xiangqiboard.js），
 * 暗棋是 4×8，同一套棋子圖自己排。
 */

import { RED, pieceSide, pieceType } from "./xiangqi.js";

const FILES = "abcdefghi";
const TYPE_CODE = ["K", "A", "B", "N", "R", "C", "P"];
const ART = {
  K: "king",
  A: "advisor",
  B: "elephant",
  N: "horse",
  R: "chariot",
  C: "cannon",
  P: "soldier",
};

function indexToSquare(index) {
  const x = index % 9;
  const y = (index / 9) | 0;
  return FILES[x] + String(9 - y);
}

function squareToIndex(square) {
  const x = FILES.indexOf(square[0]);
  const y = 9 - Number(square[1]);
  return y * 9 + x;
}

function pieceCode(p) {
  const side = pieceSide(p) === RED ? "r" : "b";
  return side + TYPE_CODE[pieceType(p)];
}

function pieceSrc(code) {
  const folder = code[0] === "r" ? "red" : "black";
  return `assets/pieces/art/${folder}/${ART[code[1]]}.png`;
}

function positionFromBoard(board) {
  const pos = {};
  for (let i = 0; i < 90; i++) {
    if (!board[i]) continue;
    pos[indexToSquare(i)] = pieceCode(board[i]);
  }
  return pos;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createStage(host, { onPick, onCue, canDrag, canDrop, commitDrag }) {
  const xq = document.createElement("div");
  xq.id = "xq-board";
  const bq = document.createElement("div");
  bq.id = "bq-board";
  bq.hidden = true;
  host.append(xq, bq);
  const frame = host.getBoundingClientRect();
  xq.style.width = Math.max(9 * 16, Math.floor(frame.width || 360)) + "px";

  const config = {
    draggable: true,
    showNotation: false,
    showErrors: "console",
    pieceTheme: pieceSrc,
    boardTheme: "vendor/xiangqiboard.svg",
    moveSpeed: 240,
    appearSpeed: 160,
    snapSpeed: 30,
    snapbackSpeed: 60,
    trashSpeed: 80,
    onDragStart(source) {
      return canDrag(squareToIndex(source));
    },
    onDrop(source, target) {
      if (source === target || target === "offboard") return "snapback";
      suppressClick = true;
      const from = squareToIndex(source);
      const to = squareToIndex(target);
      if (!canDrop(from, to)) {
        onPick(from);
        return "snapback";
      }
      skipAnim = true;
      commitDrag(from, to);
    },
  };

  const widget = window.Xiangqiboard(xq, config);
  let mode = "xiangqi";
  let current = null;
  let seated = "red";
  let speedMul = 1;
  let skipAnim = false;
  let suppressClick = false;
  let animGen = 0;
  let guides = { selected: null, targets: [], last: null, hint: null };

  function boxSize() {
    const rect = host.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function fittedWidth(cols, rows) {
    const { w, h } = boxSize();
    const border = 8;
    let width = Math.max(0, w);
    const heightFor = (value) => ((Math.max(value, cols) - 1) / cols) * rows + border;
    if (heightFor(width) > h) width = ((h - border) * cols) / rows + 1;
    return Math.max(cols * 16, Math.floor(width));
  }

  function fitXiangqi() {
    xq.style.width = fittedWidth(9, 10) + "px";
    widget.resize();
  }

  function cellEl(index, square) {
    if (mode === "xiangqi") return xq.querySelector(`[data-square="${square || indexToSquare(index)}"]`);
    return bq.querySelector(`[data-i="${index}"]`);
  }

  function applyGuides() {
    const root = mode === "xiangqi" ? xq : bq;
    root.querySelectorAll("[data-square], [data-i]").forEach((el) => {
      el.classList.remove("jz-selected", "jz-target", "jz-last", "jz-hint");
    });
    const mark = (index, cls) => {
      if (index == null) return;
      cellEl(index)?.classList.add(cls);
    };
    mark(guides.selected, "jz-selected");
    for (const target of guides.targets || []) mark(target, "jz-target");
    if (guides.last?.from != null) {
      mark(guides.last.from, "jz-last");
      mark(guides.last.to, "jz-last");
    } else if (guides.last?.index != null) {
      mark(guides.last.index, "jz-last");
    }
    if (guides.hint?.from != null) mark(guides.hint.from, "jz-hint");
    if (guides.hint?.to != null) mark(guides.hint.to, "jz-hint");
    if (guides.hint?.kind === "flip") mark(guides.hint.index, "jz-hint");
  }

  function paintBanqi(state) {
    bq.style.width = fittedWidth(8, 4) + "px";
    if (bq.childElementCount !== 32) {
      bq.replaceChildren();
      for (let i = 0; i < 32; i++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.i = String(i);
        bq.append(cell);
      }
    }
    for (let i = 0; i < 32; i++) {
      const cell = bq.children[i];
      const piece = state.banqi.pieces[i];
      if (state.banqi.face[i] !== 2) {
        cell.replaceChildren(Object.assign(document.createElement("span"), { className: "token" }));
        continue;
      }
      const img = document.createElement("img");
      img.className = "fig";
      img.alt = "";
      img.src = pieceSrc(pieceCode(piece));
      cell.replaceChildren(img);
    }
  }

  function playMove(from, to) {
    const gen = animGen;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const prev = config.onMoveEnd;
      config.onMoveEnd = (oldPos, newPos) => {
        config.onMoveEnd = prev;
        if (typeof prev === "function") prev(oldPos, newPos);
        if (gen === animGen) finish();
      };
      widget.move(`${indexToSquare(from)}-${indexToSquare(to)}`);
      setTimeout(() => {
        if (gen === animGen) finish();
      }, Number(config.moveSpeed) + 80);
    });
  }

  host.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (mode === "xiangqi") {
      const square = event.target.closest?.("[data-square]");
      if (!square) return;
      onPick(squareToIndex(square.dataset.square));
      return;
    }
    const cell = event.target.closest?.("[data-i]");
    if (!cell) return;
    onPick(Number(cell.dataset.i));
  });

  window.addEventListener("resize", () => {
    if (mode === "xiangqi") fitXiangqi();
    else if (current) paintBanqi(current);
    applyGuides();
  });

  function layout(state) {
    animGen += 1;
    current = state;
    mode = state.mode;
    host.dataset.kind = mode;
    if (mode === "xiangqi") {
      bq.hidden = true;
      xq.hidden = false;
      fitXiangqi();
      widget.position(positionFromBoard(state.board), false);
      return;
    }
    xq.hidden = true;
    bq.hidden = false;
    paintBanqi(state);
  }

  function faceSide(side) {
    seated = side === 1 ? "black" : "red";
    xq.dataset.face = seated;
    if (mode === "xiangqi" && widget.orientation() !== seated) widget.orientation(seated);
  }

  async function relocate(motion) {
    const kind = motion.type;
    onCue?.({ kind: "move", type: kind, capture: motion.capture, cannon: motion.cannon, voice: !motion.capture || !!motion.cannon });
    if (mode === "banqi" && current) {
      const fromEl = bq.querySelector(`[data-i="${motion.from}"] .fig, [data-i="${motion.from}"] .token`);
      const fromRect = fromEl?.getBoundingClientRect();
      paintBanqi(current);
      const fig = bq.querySelector(`[data-i="${motion.to}"] .fig`);
      if (fromRect && fig) {
        const toRect = fig.getBoundingClientRect();
        const anim = fig.animate(
          [
            { transform: `translate(${fromRect.left - toRect.left}px, ${fromRect.top - toRect.top}px)` },
            { transform: "none" },
          ],
          { duration: (motion.capture ? 280 : 220) / speedMul, easing: "ease-out" },
        );
        await anim.finished.catch(() => {});
      }
    } else if (!skipAnim && motion.from != null) {
      await playMove(motion.from, motion.to);
    }
    skipAnim = false;
    if (motion.capture) onCue?.({ kind: "hit", type: kind, cannon: motion.cannon, voice: true });
  }

  async function flip(index) {
    onCue?.({ kind: "flip" });
    const cell = bq.querySelector(`[data-i="${index}"]`);
    cell?.classList.add("flipping");
    await wait(460 / speedMul);
    cell?.classList.remove("flipping");
  }

  return {
    layout,
    faceSide,
    showGuides(next) {
      guides = next || guides;
      applyGuides();
    },
    relocate,
    flip,
    setLabels() {},
    setCloseup() {},
    setSpeed(value) {
      speedMul = value || 1;
      config.moveSpeed = speedMul > 1 ? 110 : 240;
    },
    setQuality() {},
    resetView() {
      if (mode !== "xiangqi") return;
      const next = widget.orientation() === "red" ? "black" : "red";
      xq.dataset.face = next;
      widget.orientation(next);
      applyGuides();
    },
    projectIndex(index) {
      const el = cellEl(index);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    projectSquare(file, rank) {
      return this.projectIndex(rank * 9 + file);
    },
    boardInside() {
      const el = mode === "xiangqi" ? xq.querySelector(".board-1ef78") : bq;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const frame = host.getBoundingClientRect();
      return rect.width > frame.width * 0.7 && rect.top >= frame.top - 2 && rect.bottom <= frame.bottom + 2;
    },
    debugFrame() {
      const el = mode === "xiangqi" ? xq.querySelector(".board-1ef78") : bq;
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, seated };
    },
  };
}
