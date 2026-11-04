/**
 * 中國象棋規則。棋盤 9 路 × 10 橫，交叉點走子。
 * y = 0 在上方（黑方底線），y = 9 在下方（紅方底線），x 由左至右 0–8。
 * 子力編碼：0 空；1–7 紅 帥仕相傌俥炮兵；8–14 黑 將士象馬車砲卒。
 */

export const RED = 0;
export const BLACK = 1;

export const K = 0;
export const A = 1;
export const E = 2;
export const H = 3;
export const R = 4;
export const C = 5;
export const P = 6;

const TYPE_COUNT = 7;

export function piece(side, type) {
  return side === RED ? type + 1 : type + 1 + TYPE_COUNT;
}

export function pieceSide(p) {
  if (p === 0) return -1;
  return p <= TYPE_COUNT ? RED : BLACK;
}

export function pieceType(p) {
  if (p === 0) return -1;
  return (p - 1) % TYPE_COUNT;
}

export const GLYPH = {
  [piece(RED, K)]: "帥",
  [piece(RED, A)]: "仕",
  [piece(RED, E)]: "相",
  [piece(RED, H)]: "傌",
  [piece(RED, R)]: "俥",
  [piece(RED, C)]: "炮",
  [piece(RED, P)]: "兵",
  [piece(BLACK, K)]: "將",
  [piece(BLACK, A)]: "士",
  [piece(BLACK, E)]: "象",
  [piece(BLACK, H)]: "馬",
  [piece(BLACK, R)]: "車",
  [piece(BLACK, C)]: "砲",
  [piece(BLACK, P)]: "卒",
};

/** 棋譜用字。車馬紅黑同字，由先後與進退分辨。 */
const NOTE_NAME = {
  [RED]: ["帥", "仕", "相", "馬", "車", "炮", "兵"],
  [BLACK]: ["將", "士", "象", "馬", "車", "砲", "卒"],
};

const RED_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function other(side) {
  return side === RED ? BLACK : RED;
}

export function onBoard(x, y) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

export function inPalace(side, x, y) {
  if (x < 3 || x > 5) return false;
  return side === RED ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

function onOwnSide(side, y) {
  return side === RED ? y >= 5 : y <= 4;
}

export function pawnCrossed(side, y) {
  return side === RED ? y <= 4 : y >= 5;
}

function sq(x, y) {
  return y * 9 + x;
}

export function xy(index) {
  return { x: index % 9, y: (index / 9) | 0 };
}

export function cloneBoard(board) {
  return board.slice();
}

export function startingBoard() {
  const b = new Uint8Array(90);
  const back = [R, H, E, A, K, A, E, H, R];
  for (let x = 0; x < 9; x++) {
    b[sq(x, 0)] = piece(BLACK, back[x]);
    b[sq(x, 9)] = piece(RED, back[x]);
  }
  b[sq(1, 2)] = piece(BLACK, C);
  b[sq(7, 2)] = piece(BLACK, C);
  b[sq(1, 7)] = piece(RED, C);
  b[sq(7, 7)] = piece(RED, C);
  for (const x of [0, 2, 4, 6, 8]) {
    b[sq(x, 3)] = piece(BLACK, P);
    b[sq(x, 6)] = piece(RED, P);
  }
  return b;
}

export function findKing(board, side) {
  const target = piece(side, K);
  for (let i = 0; i < 90; i++) if (board[i] === target) return i;
  return -1;
}

/** 將帥同線且中間無子。這是非法局面，不算飛將吃子。 */
export function kingsFace(board) {
  const rk = findKing(board, RED);
  const bk = findKing(board, BLACK);
  if (rk < 0 || bk < 0) return false;
  if (rk % 9 !== bk % 9) return false;
  const x = rk % 9;
  const y0 = Math.min((rk / 9) | 0, (bk / 9) | 0);
  const y1 = Math.max((rk / 9) | 0, (bk / 9) | 0);
  for (let y = y0 + 1; y < y1; y++) if (board[sq(x, y)] !== 0) return false;
  return true;
}

function rayHas(board, x, y, dx, dy, attacker, cannon) {
  let cx = x + dx;
  let cy = y + dy;
  if (!cannon) {
    while (onBoard(cx, cy)) {
      const p = board[sq(cx, cy)];
      if (p !== 0) return p === attacker;
      cx += dx;
      cy += dy;
    }
    return false;
  }
  let screened = false;
  while (onBoard(cx, cy)) {
    const p = board[sq(cx, cy)];
    if (!screened) {
      if (p !== 0) screened = true;
    } else if (p !== 0) {
      return p === attacker;
    }
    cx += dx;
    cy += dy;
  }
  return false;
}

/** bySide 的子是否攻擊 sq。不含將帥照面。 */
export function isAttacked(board, index, bySide) {
  const x = index % 9;
  const y = (index / 9) | 0;

  if (bySide === RED) {
    if (y + 1 <= 9 && board[sq(x, y + 1)] === piece(RED, P)) return true;
    if (y <= 4) {
      if (x > 0 && board[sq(x - 1, y)] === piece(RED, P)) return true;
      if (x < 8 && board[sq(x + 1, y)] === piece(RED, P)) return true;
    }
  } else {
    if (y - 1 >= 0 && board[sq(x, y - 1)] === piece(BLACK, P)) return true;
    if (y >= 5) {
      if (x > 0 && board[sq(x - 1, y)] === piece(BLACK, P)) return true;
      if (x < 8 && board[sq(x + 1, y)] === piece(BLACK, P)) return true;
    }
  }

  const king = piece(bySide, K);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (onBoard(nx, ny) && board[sq(nx, ny)] === king && inPalace(bySide, nx, ny)) return true;
  }

  const advisor = piece(bySide, A);
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (!onBoard(nx, ny) || board[sq(nx, ny)] !== advisor) continue;
    if (inPalace(bySide, nx, ny) && inPalace(bySide, x, y)) return true;
  }

  const elephant = piece(bySide, E);
  for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (!onBoard(nx, ny) || board[sq(nx, ny)] !== elephant) continue;
    if (!onOwnSide(bySide, ny) || !onOwnSide(bySide, y)) continue;
    if (board[sq(x + dx / 2, y + dy / 2)] !== 0) continue;
    return true;
  }

  const horse = piece(bySide, H);
  for (const [dx, dy] of [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]]) {
    const hx = x - dx;
    const hy = y - dy;
    if (!onBoard(hx, hy) || board[sq(hx, hy)] !== horse) continue;
    const legx = hx + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
    const legy = hy + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
    if (board[sq(legx, legy)] !== 0) continue;
    return true;
  }

  const rook = piece(bySide, R);
  const cannon = piece(bySide, C);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (rayHas(board, x, y, dx, dy, rook, false)) return true;
    if (rayHas(board, x, y, dx, dy, cannon, true)) return true;
  }
  return false;
}

export function inCheck(board, side) {
  const k = findKing(board, side);
  if (k < 0) return true;
  if (kingsFace(board)) return true;
  return isAttacked(board, k, other(side));
}

function pushSlide(board, moves, x, y, dx, dy, side, cannon) {
  let cx = x + dx;
  let cy = y + dy;
  if (!cannon) {
    while (onBoard(cx, cy)) {
      const p = board[sq(cx, cy)];
      if (p === 0) moves.push({ from: sq(x, y), to: sq(cx, cy) });
      else {
        if (pieceSide(p) !== side) moves.push({ from: sq(x, y), to: sq(cx, cy) });
        break;
      }
      cx += dx;
      cy += dy;
    }
    return;
  }
  let screened = false;
  while (onBoard(cx, cy)) {
    const p = board[sq(cx, cy)];
    if (!screened) {
      if (p === 0) moves.push({ from: sq(x, y), to: sq(cx, cy) });
      else screened = true;
    } else if (p !== 0) {
      if (pieceSide(p) !== side) moves.push({ from: sq(x, y), to: sq(cx, cy) });
      break;
    }
    cx += dx;
    cy += dy;
  }
}

function pseudoMovesAt(board, index, out) {
  const p = board[index];
  const side = pieceSide(p);
  const type = pieceType(p);
  const x = index % 9;
  const y = (index / 9) | 0;

  if (type === K) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inPalace(side, nx, ny)) continue;
      const t = board[sq(nx, ny)];
      if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny) });
    }
    return;
  }

  if (type === A) {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inPalace(side, nx, ny)) continue;
      const t = board[sq(nx, ny)];
      if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny) });
    }
    return;
  }

  if (type === E) {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!onBoard(nx, ny) || !onOwnSide(side, ny)) continue;
      if (board[sq(x + dx / 2, y + dy / 2)] !== 0) continue;
      const t = board[sq(nx, ny)];
      if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny) });
    }
    return;
  }

  if (type === H) {
    for (const [dx, dy] of [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!onBoard(nx, ny)) continue;
      const legx = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
      const legy = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
      if (board[sq(legx, legy)] !== 0) continue;
      const t = board[sq(nx, ny)];
      if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny) });
    }
    return;
  }

  if (type === R || type === C) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      pushSlide(board, out, x, y, dx, dy, side, type === C);
    }
    return;
  }

  const forward = side === RED ? -1 : 1;
  const ny = y + forward;
  if (onBoard(x, ny)) {
    const t = board[sq(x, ny)];
    if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(x, ny) });
  }
  if (pawnCrossed(side, y)) {
    for (const nx of [x - 1, x + 1]) {
      if (!onBoard(nx, y)) continue;
      const t = board[sq(nx, y)];
      if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, y) });
    }
  }
}

export function pseudoMoves(board, side) {
  const out = [];
  for (let i = 0; i < 90; i++) if (pieceSide(board[i]) === side) pseudoMovesAt(board, i, out);
  return out;
}

export function applyMove(board, from, to) {
  const next = board.slice();
  next[to] = next[from];
  next[from] = 0;
  return next;
}

export function legalMoves(board, side) {
  const pseudo = pseudoMoves(board, side);
  const out = [];
  for (const m of pseudo) {
    const next = applyMove(board, m.from, m.to);
    if (!inCheck(next, side)) out.push(m);
  }
  return out;
}

export function legalMovesFrom(board, side, from) {
  return legalMoves(board, side).filter((m) => m.from === from);
}

/**
 * 無子可走即負。被將軍是將死，否則是困斃。
 * 回傳 null 表示還沒分出勝負。
 */
export function terminal(board, side) {
  if (legalMoves(board, side).length > 0) return null;
  if (inCheck(board, side)) return { kind: "mate", loser: side };
  return { kind: "stalemate", loser: side };
}

export function fileLabel(side, x) {
  if (side === RED) return RED_NUM[8 - x];
  return String(x + 1);
}

export function stepLabel(side, n) {
  if (side === RED) return RED_NUM[n - 1];
  return String(n);
}

function multiTag(count, index, side) {
  if (count === 2) return index === 0 ? "前" : "後";
  if (count === 3) return ["前", "中", "後"][index];
  if (index === 0) return "前";
  if (index === count - 1) return "後";
  return stepLabel(side, index + 1);
}

/** 走子前記譜。board 是還沒走的局面。 */
export function notation(board, from, to) {
  const p = board[from];
  const side = pieceSide(p);
  const type = pieceType(p);
  const name = NOTE_NAME[side][type];
  const x = from % 9;
  const y = (from / 9) | 0;
  const nx = to % 9;
  const ny = (to / 9) | 0;

  const ranks = [];
  for (let yy = 0; yy < 10; yy++) {
    const q = board[sq(x, yy)];
    if (pieceSide(q) === side && pieceType(q) === type) ranks.push(yy);
  }
  if (side === BLACK) ranks.reverse();

  let head;
  if (ranks.length === 1) head = name + fileLabel(side, x);
  else head = multiTag(ranks.length, ranks.indexOf(y), side) + name;

  const forward = side === RED ? ny < y : ny > y;
  let tail;
  if (type === H || type === E || type === A) {
    tail = (forward ? "進" : "退") + fileLabel(side, nx);
  } else if (nx !== x) {
    tail = "平" + fileLabel(side, nx);
  } else {
    tail = (forward ? "進" : "退") + stepLabel(side, Math.abs(ny - y));
  }
  return head + tail;
}

export function positionKey(board, side) {
  let s = "";
  for (let i = 0; i < 90; i++) s += String.fromCharCode(board[i] + 32);
  return s + (side === RED ? "r" : "b");
}

/**
 * keys[0] 是起始局面（含行棋方）。keys[i] 是第 i 步之後。
 * movers[i]、gaveCheck[i] 對應第 i 步，下標 0 留空。
 */
export function judgeRepetition(keys, movers, gaveCheck) {
  const last = keys[keys.length - 1];
  const idxs = [];
  for (let i = 0; i < keys.length; i++) if (keys[i] === last) idxs.push(i);
  if (idxs.length < 3) return null;
  const from = idxs[idxs.length - 3];
  const to = idxs[idxs.length - 1];
  let redMoves = 0;
  let redChecks = 0;
  let blackMoves = 0;
  let blackChecks = 0;
  for (let ply = from + 1; ply <= to; ply++) {
    if (movers[ply] === RED) {
      redMoves++;
      if (gaveCheck[ply]) redChecks++;
    } else {
      blackMoves++;
      if (gaveCheck[ply]) blackChecks++;
    }
  }
  const redPerp = redMoves > 0 && redChecks === redMoves;
  const blackPerp = blackMoves > 0 && blackChecks === blackMoves;
  if (redPerp && !blackPerp) return { type: "loss", loser: RED, reason: "長將" };
  if (blackPerp && !redPerp) return { type: "loss", loser: BLACK, reason: "長將" };
  return { type: "draw", reason: "三次重複" };
}

export function perft(board, side, depth) {
  return perftDetail(board, side, depth).nodes;
}

export function perftDetail(board, side, depth) {
  const moves = legalMoves(board, side);
  if (depth === 1) {
    let captures = 0;
    let checks = 0;
    for (const m of moves) {
      if (board[m.to] !== 0) captures++;
      const next = applyMove(board, m.from, m.to);
      if (inCheck(next, other(side))) checks++;
    }
    return { nodes: moves.length, captures, checks };
  }
  let nodes = 0;
  let captures = 0;
  let checks = 0;
  for (const m of moves) {
    const next = applyMove(board, m.from, m.to);
    const sub = perftDetail(next, other(side), depth - 1);
    nodes += sub.nodes;
    captures += sub.captures;
    checks += sub.checks;
  }
  return { nodes, captures, checks };
}

export function formatBoard(board) {
  let s = "";
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[sq(x, y)];
      s += (p === 0 ? "·" : GLYPH[p]) + " ";
    }
    s += "\n";
  }
  return s;
}

export function sameBoard(a, b) {
  for (let i = 0; i < 90; i++) if (a[i] !== b[i]) return false;
  return true;
}
