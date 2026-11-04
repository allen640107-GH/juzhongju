/**
 * 人機。入門看一步並在好棋裡抽一著；進階深度 2；高手深度 3，超時就用已算完的較淺結果。
 */
import {
  A,
  BLACK,
  C,
  E,
  H,
  K,
  P,
  R,
  RED,
  applyMove,
  inCheck,
  legalMoves,
  other,
  pieceSide,
  pieceType,
  sameBoard,
  startingBoard,
} from "./xiangqi.js";

const VALUE = {
  [K]: 10000,
  [R]: 900,
  [C]: 450,
  [H]: 400,
  [E]: 180,
  [A]: 180,
  [P]: 60,
};

const BOOK = [
  { from: 7 * 9 + 7, to: 7 * 9 + 4 },
  { from: 7 * 9 + 1, to: 7 * 9 + 4 },
  { from: 9 * 9 + 7, to: 7 * 9 + 6 },
  { from: 9 * 9 + 1, to: 7 * 9 + 2 },
  { from: 6 * 9 + 6, to: 5 * 9 + 6 },
  { from: 6 * 9 + 2, to: 5 * 9 + 2 },
];

function pst(type, side, x, y) {
  const fy = side === RED ? 9 - y : y;
  const center = 4 - Math.abs(x - 4);
  switch (type) {
    case K:
      return (fy === 0 ? 8 : 0) + (x === 4 ? 6 : 0);
    case A:
      return center;
    case E:
      return fy <= 2 ? 4 : 0;
    case H:
      return center * 6 + fy * 3;
    case R:
      return fy * 5 + center * 2;
    case C:
      return center * 8 + (x === 4 ? 14 : 0);
    case P: {
      if (fy <= 4) return fy * 2;
      return 28 + fy * 6 + (center >= 3 ? 10 : 0);
    }
    default:
      return 0;
  }
}

export function evaluate(board) {
  let score = 0;
  for (let i = 0; i < 90; i++) {
    const p = board[i];
    if (p === 0) continue;
    const side = pieceSide(p);
    const type = pieceType(p);
    const x = i % 9;
    const y = (i / 9) | 0;
    let v = VALUE[type] + pst(type, side, x, y);
    if (type === P && ((side === RED && y <= 4) || (side === BLACK && y >= 5))) v += 40;
    score += side === RED ? v : -v;
  }
  return score;
}

function moveScore(board, move) {
  const victim = board[move.to];
  if (victim === 0) return 0;
  return VALUE[pieceType(victim)] * 8 - VALUE[pieceType(board[move.from])];
}

function orderMoves(board, moves) {
  return moves
    .map((m, i) => ({ m, i, s: moveScore(board, m) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((row) => row.m);
}

function viewpoint(board, side) {
  const e = evaluate(board);
  return side === RED ? e : -e;
}

function stopSearch(budget) {
  budget.nodes++;
  if (budget.nodes > budget.limit || Date.now() > budget.deadline) {
    const err = new Error("budget");
    err.code = "budget";
    throw err;
  }
}

/** 深度用盡後繼續算吃子，避免「砲打馬、車回吃」被地平線切掉。 */
function quiesce(board, side, alpha, beta, budget, ply) {
  stopSearch(budget);
  const all = legalMoves(board, side);
  if (all.length === 0) return -100000 + ply;
  const checked = inCheck(board, side);
  let best = -Infinity;
  if (!checked) {
    best = viewpoint(board, side);
    if (best >= beta) return best;
    if (best > alpha) alpha = best;
  }
  const moves = checked ? all : all.filter((m) => board[m.to] !== 0);
  for (const m of orderMoves(board, moves)) {
    const next = applyMove(board, m.from, m.to);
    const score = -quiesce(next, other(side), -beta, -alpha, budget, ply + 1);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(board, side, depth, alpha, beta, budget, ply) {
  stopSearch(budget);
  const moves = legalMoves(board, side);
  if (moves.length === 0) return -100000 + ply;
  if (depth === 0) return quiesce(board, side, alpha, beta, budget, ply);
  let best = -Infinity;
  for (const m of orderMoves(board, moves)) {
    const next = applyMove(board, m.from, m.to);
    const score = -negamax(next, other(side), depth - 1, -beta, -alpha, budget, ply + 1);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function searchRoot(board, side, depth, deadline) {
  const moves = orderMoves(board, legalMoves(board, side));
  if (moves.length === 0) return null;
  const budget = { nodes: 0, limit: depth >= 3 ? 250000 : 120000, deadline, rootDepth: depth };
  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  const scored = [];
  for (const m of moves) {
    const next = applyMove(board, m.from, m.to);
    let score;
    try {
      score = -negamax(next, other(side), depth - 1, -beta, -alpha, budget, 1);
    } catch (err) {
      if (err.code !== "budget") throw err;
      break;
    }
    scored.push({ move: m, score });
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
    if (score > alpha) alpha = score;
  }
  if (!best) return null;
  return { move: best, score: bestScore, all: scored, partial: scored.length < moves.length };
}

function bookMove(board, side) {
  if (side !== RED || !sameBoard(board, startingBoard())) return null;
  const legal = new Set(legalMoves(board, side).map((m) => `${m.from}-${m.to}`));
  const pool = BOOK.filter((m) => legal.has(`${m.from}-${m.to}`));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * level 1 入門、2 進階、3 高手。
 * 回傳 { from, to } 或 null。
 */
export function bestMove(board, side, level) {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return null;

  if (level <= 1) {
    const booked = bookMove(board, side);
    if (booked && Math.random() < 0.85) return booked;
    const ranked = moves
      .map((m) => {
        const next = applyMove(board, m.from, m.to);
        const e = evaluate(next);
        const score = side === RED ? e : -e;
        const checkBonus = inCheck(next, other(side)) ? 40 : 0;
        return { m, score: score + checkBonus };
      })
      .sort((a, b) => b.score - a.score);
    const top = ranked.filter((row) => row.score >= ranked[0].score - 35).slice(0, 4);
    return top[Math.floor(Math.random() * top.length)].m;
  }

  if (level === 2) {
    const booked = bookMove(board, side);
    if (booked && Math.random() < 0.55) return booked;
  }

  const maxDepth = level >= 3 ? 3 : 2;
  const deadline = Date.now() + (level >= 3 ? 1100 : 450);
  let chosen = null;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() > deadline && chosen) break;
    try {
      const result = searchRoot(board, side, depth, deadline);
      if (!result) break;
      if (result.all && result.all.length > 1 && level < 3) {
        const near = result.all.filter((row) => row.score >= result.score - 8);
        chosen = near[Math.floor(Math.random() * near.length)].move;
      } else {
        chosen = result.move;
      }
      if (result.partial) break;
    } catch (err) {
      if (err.code !== "budget") throw err;
      break;
    }
  }
  return chosen || moves[0];
}
