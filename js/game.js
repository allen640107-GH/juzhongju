/**
 * 對局流程：象棋與暗棋共用悔棋、勝負與存檔。畫面不在這裡。
 */
import { bestMove } from "./ai.js";
import { applyBanqi, banqiMoves, chooseBanqiMove, cloneBanqi, colorOfPlayer, newBanqi } from "./banqi.js";
import {
  BLACK,
  GLYPH,
  RED,
  applyMove,
  inCheck,
  judgeRepetition,
  legalMovesFrom,
  notation,
  other,
  pieceSide,
  positionKey,
  startingBoard,
  terminal,
} from "./xiangqi.js";

export function newXiangqi({ vs = "ai", level = 2, humanSide = RED } = {}) {
  const board = startingBoard();
  return {
    mode: "xiangqi",
    vs,
    level,
    humanSide,
    board,
    side: RED,
    noCapture: 0,
    record: [],
    keys: [positionKey(board, RED)],
    movers: [null],
    checks: [null],
    past: [],
    last: null,
    over: null,
    hint: null,
  };
}

export function newDark({ vs = "ai", level = 2 } = {}) {
  return {
    mode: "banqi",
    vs,
    level,
    humanSide: 0,
    banqi: newBanqi(),
    record: [],
    past: [],
    last: null,
    over: null,
    hint: null,
  };
}

function remember(state) {
  if (state.mode === "xiangqi") {
    state.past.push({
      board: state.board.slice(),
      side: state.side,
      noCapture: state.noCapture,
      record: state.record.slice(),
      keys: state.keys.slice(),
      movers: state.movers.slice(),
      checks: state.checks.slice(),
      last: state.last,
      over: state.over,
    });
  } else {
    state.past.push({
      banqi: cloneBanqi(state.banqi),
      record: state.record.slice(),
      last: state.last,
      over: state.over,
    });
  }
  if (state.past.length > 300) state.past.shift();
}

export function xiangqiTargets(state, from) {
  if (state.over || pieceSide(state.board[from]) !== state.side) return [];
  return legalMovesFrom(state.board, state.side, from).map((m) => m.to);
}

export function playXiangqi(state, from, to) {
  if (state.over) return false;
  const legal = legalMovesFrom(state.board, state.side, from);
  if (!legal.some((m) => m.to === to)) return false;
  remember(state);
  const note = notation(state.board, from, to);
  const captured = state.board[to] !== 0;
  const mover = state.side;
  const next = applyMove(state.board, from, to);
  const gave = inCheck(next, other(mover));
  state.board = next;
  state.side = other(mover);
  state.noCapture = captured ? 0 : state.noCapture + 1;
  state.record.push(note);
  state.keys.push(positionKey(next, state.side));
  state.movers.push(mover);
  state.checks.push(gave);
  state.last = { from, to };
  state.hint = null;
  state.over = endOfXiangqi(state);
  return true;
}

function endOfXiangqi(state) {
  const done = terminal(state.board, state.side);
  if (done) return done;
  const rep = judgeRepetition(state.keys, state.movers, state.checks);
  if (rep) return rep;
  if (state.noCapture >= 120) return { type: "draw", reason: "六十回合未吃子" };
  return null;
}

export function banqiTargets(state, from) {
  if (state.over) return [];
  return banqiMoves(state.banqi)
    .filter((m) => m.kind === "move" && m.from === from)
    .map((m) => m.to);
}

export function playBanqi(state, move) {
  if (state.over) return false;
  const legal = banqiMoves(state.banqi).some((m) => {
    if (m.kind !== move.kind) return false;
    if (m.kind === "flip") return m.index === move.index;
    return m.from === move.from && m.to === move.to;
  });
  if (!legal) return false;
  remember(state);
  state.record.push(banqiNote(state.banqi, move));
  state.last = move.kind === "flip" ? { index: move.index } : { from: move.from, to: move.to };
  state.banqi = applyBanqi(state.banqi, move);
  state.hint = null;
  state.over = state.banqi.over;
  return true;
}

function banqiNote(before, move) {
  if (move.kind === "flip") return `翻${GLYPH[before.pieces[move.index]]}`;
  const name = GLYPH[before.pieces[move.from]];
  if (before.pieces[move.to] !== 0) return `${name}吃${GLYPH[before.pieces[move.to]]}`;
  return `${name}進`;
}

export function undo(state) {
  const prev = state.past.pop();
  if (!prev) return false;
  if (state.mode === "xiangqi") {
    state.board = prev.board;
    state.side = prev.side;
    state.noCapture = prev.noCapture;
    state.record = prev.record;
    state.keys = prev.keys;
    state.movers = prev.movers;
    state.checks = prev.checks;
  } else {
    state.banqi = prev.banqi;
  }
  state.record = prev.record;
  state.last = prev.last;
  state.over = prev.over;
  state.hint = null;
  return true;
}

/** 人機時一次悔回自己的著，連電腦應的那步一起拿掉。 */
export function undoTurn(state) {
  if (state.past.length === 0) return false;
  if (state.mode === "xiangqi" && state.vs === "ai") {
    const aiSide = state.humanSide === RED ? BLACK : RED;
    const last = state.movers[state.movers.length - 1];
    undo(state);
    if (last === aiSide && state.movers.length > 1) undo(state);
    return true;
  }
  if (state.mode === "banqi" && state.vs === "ai") {
    const lastWasAi = state.banqi.turn === 0 && state.past.length > 0;
    undo(state);
    if (lastWasAi && state.banqi.turn === 1) undo(state);
    return true;
  }
  return undo(state);
}

export function isAiTurn(state) {
  if (state.over || state.vs !== "ai") return false;
  if (state.mode === "xiangqi") return state.side !== state.humanSide;
  return state.banqi.turn === 1;
}

export function think(state) {
  if (state.mode === "xiangqi") return bestMove(state.board, state.side, state.level);
  return chooseBanqiMove(state.banqi, state.level);
}

export function hintMove(state) {
  if (state.over) return null;
  if (state.mode === "xiangqi") {
    const move = bestMove(state.board, state.side, state.level >= 3 ? 2 : Math.max(state.level, 2));
    if (!move) return null;
    state.hint = move;
    return { move, note: notation(state.board, move.from, move.to) };
  }
  const move = chooseBanqiMove(state.banqi, Math.max(state.level, 2));
  state.hint = move;
  return move ? { move, note: banqiNote(state.banqi, move) } : null;
}

export function sideName(side) {
  return side === RED ? "紅方" : "黑方";
}

export function resultText(state) {
  const end = state.over;
  if (!end) return "";
  if (end.type === "draw") return `和棋 · ${end.reason}`;
  if (state.mode === "banqi") {
    const winner = end.loser === 0 ? "後手" : "先手";
    return `${winner}勝 · ${end.reason}`;
  }
  const winner = sideName(other(end.loser));
  if (end.kind === "mate") return `${winner}勝 · 將死`;
  if (end.kind === "stalemate") return `${winner}勝 · 困斃`;
  return `${winner}勝 · ${end.reason}`;
}

export function turnText(state) {
  if (state.over) return resultText(state);
  if (state.mode === "xiangqi") {
    const check = inCheck(state.board, state.side) ? " · 將軍" : "";
    return `${sideName(state.side)}走${check}`;
  }
  const player = state.banqi.turn === 0 ? "先手" : "後手";
  const color = colorOfPlayer(state.banqi, state.banqi.turn);
  const who = color < 0 ? player : `${player}（${sideName(color)}）`;
  return `${who}走`;
}

export function sealText(state) {
  if (!state.over) return "";
  if (state.over.type === "draw") return "和棋";
  if (state.mode === "banqi") return state.over.loser === 0 ? "後手勝" : "先手勝";
  return state.over.loser === RED ? "黑勝" : "紅勝";
}

export function serialize(state) {
  if (state.mode === "xiangqi") {
    return {
      mode: "xiangqi",
      vs: state.vs,
      level: state.level,
      humanSide: state.humanSide,
      board: Array.from(state.board),
      side: state.side,
      noCapture: state.noCapture,
      record: state.record,
      keys: state.keys,
      movers: state.movers,
      checks: state.checks,
      last: state.last,
      over: state.over,
      past: state.past.map((p) => ({
        board: Array.from(p.board),
        side: p.side,
        noCapture: p.noCapture,
        record: p.record,
        keys: p.keys,
        movers: p.movers,
        checks: p.checks,
        last: p.last,
        over: p.over,
      })),
    };
  }
  return {
    mode: "banqi",
    vs: state.vs,
    level: state.level,
    record: state.record,
    last: state.last,
    over: state.over,
    banqi: {
      pieces: Array.from(state.banqi.pieces),
      face: Array.from(state.banqi.face),
      turn: state.banqi.turn,
      owner: state.banqi.owner,
      noCapture: state.banqi.noCapture,
      over: state.banqi.over,
    },
    past: state.past.map((p) => ({
      record: p.record,
      last: p.last,
      over: p.over,
      banqi: {
        pieces: Array.from(p.banqi.pieces),
        face: Array.from(p.banqi.face),
        turn: p.banqi.turn,
        owner: p.banqi.owner,
        noCapture: p.banqi.noCapture,
        over: p.banqi.over,
      },
    })),
  };
}

function asBanqi(raw) {
  return {
    pieces: Uint8Array.from(raw.pieces),
    face: Uint8Array.from(raw.face),
    turn: raw.turn,
    owner: raw.owner.slice(),
    noCapture: raw.noCapture,
    over: raw.over,
  };
}

export function hydrate(data) {
  if (!data || (data.mode !== "xiangqi" && data.mode !== "banqi")) return null;
  if (data.mode === "xiangqi") {
    return {
      mode: "xiangqi",
      vs: data.vs,
      level: data.level,
      humanSide: data.humanSide,
      board: Uint8Array.from(data.board),
      side: data.side,
      noCapture: data.noCapture,
      record: data.record.slice(),
      keys: data.keys.slice(),
      movers: data.movers.slice(),
      checks: data.checks.slice(),
      last: data.last,
      over: data.over,
      hint: null,
      past: data.past.map((p) => ({
        board: Uint8Array.from(p.board),
        side: p.side,
        noCapture: p.noCapture,
        record: p.record,
        keys: p.keys,
        movers: p.movers,
        checks: p.checks,
        last: p.last,
        over: p.over,
      })),
    };
  }
  return {
    mode: "banqi",
    vs: data.vs,
    level: data.level,
    humanSide: 0,
    banqi: asBanqi(data.banqi),
    record: data.record.slice(),
    last: data.last,
    over: data.over,
    hint: null,
    past: data.past.map((p) => ({
      banqi: asBanqi(p.banqi),
      record: p.record,
      last: p.last,
      over: p.over,
    })),
  };
}
