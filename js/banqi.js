/**
 * 暗棋（翻棋）。4×8 格，32 子洗牌蓋住。
 * 吃子順序：將＞士＞象＞車＞馬＞砲＞兵。兵可吃將，將不吃兵。馬不能吃士。
 * 砲平常走一格；吃子必須隔正好一子，不能吃隔壁。
 */

import { A, BLACK, C, E, H, K, P, R, RED, piece, pieceSide, pieceType } from "./xiangqi.js";

export const COLS = 8;
export const ROWS = 4;
export const CELLS = COLS * ROWS;

const RANK = { [K]: 7, [A]: 6, [E]: 5, [R]: 4, [H]: 3, [C]: 2, [P]: 1 };

export function emptyBanqi() {
  return {
    pieces: new Uint8Array(CELLS),
    face: new Uint8Array(CELLS),
    turn: 0,
    owner: [null, null],
    noCapture: 0,
    over: null,
  };
}

export function newBanqi(rng = Math.random) {
  const state = emptyBanqi();
  const bag = [];
  for (const side of [RED, BLACK]) {
    bag.push(piece(side, K));
    for (let i = 0; i < 2; i++) {
      bag.push(piece(side, A), piece(side, E), piece(side, H), piece(side, R), piece(side, C));
    }
    for (let i = 0; i < 5; i++) bag.push(piece(side, P));
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  for (let i = 0; i < CELLS; i++) {
    state.pieces[i] = bag[i];
    state.face[i] = 1;
  }
  return state;
}

export function cloneBanqi(state) {
  return {
    pieces: state.pieces.slice(),
    face: state.face.slice(),
    turn: state.turn,
    owner: state.owner.slice(),
    noCapture: state.noCapture,
    over: state.over ? { ...state.over } : null,
  };
}

function on(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function idx(x, y) {
  return y * COLS + x;
}

export function colorOfPlayer(state, player) {
  if (state.owner[RED] === player) return RED;
  if (state.owner[BLACK] === player) return BLACK;
  return -1;
}

function owns(state, index) {
  if (state.face[index] !== 2) return false;
  const side = pieceSide(state.pieces[index]);
  return state.owner[side] === state.turn;
}

export function canTake(attacker, defender) {
  const at = pieceType(attacker);
  const dt = pieceType(defender);
  if (at === C) return false;
  if (at === P && dt === K) return true;
  if (at === K && dt === P) return false;
  return RANK[at] >= RANK[dt];
}

function cannonCaptureTargets(state, x, y) {
  const out = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let cx = x + dx;
    let cy = y + dy;
    let seen = false;
    while (on(cx, cy)) {
      const i = idx(cx, cy);
      if (state.pieces[i] === 0) {
        cx += dx;
        cy += dy;
        continue;
      }
      if (!seen) {
        seen = true;
        cx += dx;
        cy += dy;
        continue;
      }
      if (state.face[i] === 2 && pieceSide(state.pieces[i]) !== pieceSide(state.pieces[idx(x, y)])) {
        out.push(i);
      }
      break;
    }
  }
  return out;
}

/** 著法：{ kind:'flip', index } 或 { kind:'move', from, to } */
export function banqiMoves(state) {
  if (state.over) return [];
  const moves = [];
  for (let i = 0; i < CELLS; i++) {
    if (state.face[i] === 1) moves.push({ kind: "flip", index: i });
  }
  for (let i = 0; i < CELLS; i++) {
    if (!owns(state, i)) continue;
    const x = i % COLS;
    const y = (i / COLS) | 0;
    const p = state.pieces[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!on(nx, ny)) continue;
      const t = idx(nx, ny);
      if (state.pieces[t] === 0) moves.push({ kind: "move", from: i, to: t });
      else if (state.face[t] === 2 && pieceSide(state.pieces[t]) !== pieceSide(p) && canTake(p, state.pieces[t])) {
        moves.push({ kind: "move", from: i, to: t });
      }
    }
    if (pieceType(p) === C) {
      for (const t of cannonCaptureTargets(state, x, y)) moves.push({ kind: "move", from: i, to: t });
    }
  }
  return moves;
}

export function applyBanqi(state, move) {
  const next = cloneBanqi(state);
  let capture = false;
  if (move.kind === "flip") {
    next.face[move.index] = 2;
    const side = pieceSide(next.pieces[move.index]);
    if (next.owner[RED] == null && next.owner[BLACK] == null) {
      next.owner[side] = next.turn;
      next.owner[side === RED ? BLACK : RED] = next.turn === 0 ? 1 : 0;
    }
  } else {
    if (next.pieces[move.to] !== 0) capture = true;
    next.pieces[move.to] = next.pieces[move.from];
    next.face[move.to] = 2;
    next.pieces[move.from] = 0;
    next.face[move.from] = 0;
  }
  next.noCapture = capture ? 0 : next.noCapture + 1;
  next.turn = next.turn === 0 ? 1 : 0;
  next.over = judgeBanqi(next);
  return next;
}

function playerHasPiece(state, player) {
  for (let i = 0; i < CELLS; i++) {
    if (state.face[i] === 2 && state.owner[pieceSide(state.pieces[i])] === player) return true;
  }
  return false;
}

export function judgeBanqi(state) {
  if (state.noCapture >= 50) return { type: "draw", reason: "五十步未吃子" };
  if (state.owner[RED] == null) return null;
  if (banqiMoves(state).length > 0) return null;
  const loser = state.turn;
  return {
    type: "loss",
    loser,
    reason: playerHasPiece(state, loser) ? "無路可走" : "子力吃光",
  };
}

function material(state, player) {
  let score = 0;
  for (let i = 0; i < CELLS; i++) {
    if (state.face[i] !== 2) continue;
    if (state.owner[pieceSide(state.pieces[i])] !== player) continue;
    score += RANK[pieceType(state.pieces[i])] * 10;
  }
  return score;
}

function banqiValue(state, rootPlayer) {
  if (state.over) {
    if (state.over.type === "draw") return 0;
    return state.over.loser === rootPlayer ? -1000 : 1000;
  }
  const foe = rootPlayer === 0 ? 1 : 0;
  return material(state, rootPlayer) - material(state, foe);
}

function searchBanqi(state, depth, rootPlayer) {
  if (depth === 0 || state.over || state.owner[RED] == null) return banqiValue(state, rootPlayer);
  const moves = banqiMoves(state);
  const ordered = moves
    .map((m, i) => ({ m, i, c: m.kind === "move" && state.pieces[m.to] ? RANK[pieceType(state.pieces[m.to])] : 0 }))
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .slice(0, 12)
    .map((row) => row.m);
  if (state.turn === rootPlayer) {
    let best = -Infinity;
    for (const m of ordered) best = Math.max(best, searchBanqi(applyBanqi(state, m), depth - 1, rootPlayer));
    return best;
  }
  let best = Infinity;
  for (const m of ordered) best = Math.min(best, searchBanqi(applyBanqi(state, m), depth - 1, rootPlayer));
  return best;
}

export function chooseBanqiMove(state, level) {
  const moves = banqiMoves(state);
  if (moves.length === 0) return null;
  const captures = moves.filter((m) => m.kind === "move" && state.pieces[m.to] !== 0);
  if (level <= 1 || state.owner[RED] == null) {
    const pool = captures.length > 0 && Math.random() < 0.8 ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const depth = level >= 3 ? 2 : 1;
  const pool = moves
    .map((m, i) => ({ m, i, c: m.kind === "move" && state.pieces[m.to] ? 1 : 0 }))
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .slice(0, 16)
    .map((row) => row.m);
  let bestScore = -Infinity;
  let best = [];
  for (const m of pool) {
    const score = searchBanqi(applyBanqi(state, m), depth - 1, state.turn);
    if (score > bestScore) {
      bestScore = score;
      best = [m];
    } else if (score === bestScore) best.push(m);
  }
  return best[Math.floor(Math.random() * best.length)];
}
