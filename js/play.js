(() => {
  // js/xiangqi.js
  var RED = 0;
  var BLACK = 1;
  var K = 0;
  var A = 1;
  var E = 2;
  var H = 3;
  var R = 4;
  var C = 5;
  var P = 6;
  var TYPE_COUNT = 7;
  function piece(side, type) {
    return side === RED ? type + 1 : type + 1 + TYPE_COUNT;
  }
  function pieceSide(p) {
    if (p === 0) return -1;
    return p <= TYPE_COUNT ? RED : BLACK;
  }
  function pieceType(p) {
    if (p === 0) return -1;
    return (p - 1) % TYPE_COUNT;
  }
  var GLYPH = {
    [piece(RED, K)]: "\u5E25",
    [piece(RED, A)]: "\u4ED5",
    [piece(RED, E)]: "\u76F8",
    [piece(RED, H)]: "\u508C",
    [piece(RED, R)]: "\u4FE5",
    [piece(RED, C)]: "\u70AE",
    [piece(RED, P)]: "\u5175",
    [piece(BLACK, K)]: "\u5C07",
    [piece(BLACK, A)]: "\u58EB",
    [piece(BLACK, E)]: "\u8C61",
    [piece(BLACK, H)]: "\u99AC",
    [piece(BLACK, R)]: "\u8ECA",
    [piece(BLACK, C)]: "\u7832",
    [piece(BLACK, P)]: "\u5352"
  };
  var NOTE_NAME = {
    [RED]: ["\u5E25", "\u4ED5", "\u76F8", "\u99AC", "\u8ECA", "\u70AE", "\u5175"],
    [BLACK]: ["\u5C07", "\u58EB", "\u8C61", "\u99AC", "\u8ECA", "\u7832", "\u5352"]
  };
  var RED_NUM = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"];
  function other(side) {
    return side === RED ? BLACK : RED;
  }
  function onBoard(x, y) {
    return x >= 0 && x < 9 && y >= 0 && y < 10;
  }
  function inPalace(side, x, y) {
    if (x < 3 || x > 5) return false;
    return side === RED ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
  }
  function onOwnSide(side, y) {
    return side === RED ? y >= 5 : y <= 4;
  }
  function pawnCrossed(side, y) {
    return side === RED ? y <= 4 : y >= 5;
  }
  function sq(x, y) {
    return y * 9 + x;
  }
  function startingBoard() {
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
  function findKing(board, side) {
    const target = piece(side, K);
    for (let i = 0; i < 90; i++) if (board[i] === target) return i;
    return -1;
  }
  function kingsFace(board) {
    const rk = findKing(board, RED);
    const bk = findKing(board, BLACK);
    if (rk < 0 || bk < 0) return false;
    if (rk % 9 !== bk % 9) return false;
    const x = rk % 9;
    const y0 = Math.min(rk / 9 | 0, bk / 9 | 0);
    const y1 = Math.max(rk / 9 | 0, bk / 9 | 0);
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
  function isAttacked(board, index, bySide) {
    const x = index % 9;
    const y = index / 9 | 0;
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
  function inCheck(board, side) {
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
    const y = index / 9 | 0;
    if (type === K) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny2 = y + dy;
        if (!inPalace(side, nx, ny2)) continue;
        const t = board[sq(nx, ny2)];
        if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny2) });
      }
      return;
    }
    if (type === A) {
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx;
        const ny2 = y + dy;
        if (!inPalace(side, nx, ny2)) continue;
        const t = board[sq(nx, ny2)];
        if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny2) });
      }
      return;
    }
    if (type === E) {
      for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
        const nx = x + dx;
        const ny2 = y + dy;
        if (!onBoard(nx, ny2) || !onOwnSide(side, ny2)) continue;
        if (board[sq(x + dx / 2, y + dy / 2)] !== 0) continue;
        const t = board[sq(nx, ny2)];
        if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny2) });
      }
      return;
    }
    if (type === H) {
      for (const [dx, dy] of [[1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]]) {
        const nx = x + dx;
        const ny2 = y + dy;
        if (!onBoard(nx, ny2)) continue;
        const legx = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0);
        const legy = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0);
        if (board[sq(legx, legy)] !== 0) continue;
        const t = board[sq(nx, ny2)];
        if (t === 0 || pieceSide(t) !== side) out.push({ from: index, to: sq(nx, ny2) });
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
  function pseudoMoves(board, side) {
    const out = [];
    for (let i = 0; i < 90; i++) if (pieceSide(board[i]) === side) pseudoMovesAt(board, i, out);
    return out;
  }
  function applyMove(board, from, to) {
    const next = board.slice();
    next[to] = next[from];
    next[from] = 0;
    return next;
  }
  function legalMoves(board, side) {
    const pseudo = pseudoMoves(board, side);
    const out = [];
    for (const m of pseudo) {
      const next = applyMove(board, m.from, m.to);
      if (!inCheck(next, side)) out.push(m);
    }
    return out;
  }
  function legalMovesFrom(board, side, from) {
    return legalMoves(board, side).filter((m) => m.from === from);
  }
  function terminal(board, side) {
    if (legalMoves(board, side).length > 0) return null;
    if (inCheck(board, side)) return { kind: "mate", loser: side };
    return { kind: "stalemate", loser: side };
  }
  function fileLabel(side, x) {
    if (side === RED) return RED_NUM[8 - x];
    return String(x + 1);
  }
  function stepLabel(side, n) {
    if (side === RED) return RED_NUM[n - 1];
    return String(n);
  }
  function multiTag(count, index, side) {
    if (count === 2) return index === 0 ? "\u524D" : "\u5F8C";
    if (count === 3) return ["\u524D", "\u4E2D", "\u5F8C"][index];
    if (index === 0) return "\u524D";
    if (index === count - 1) return "\u5F8C";
    return stepLabel(side, index + 1);
  }
  function notation(board, from, to) {
    const p = board[from];
    const side = pieceSide(p);
    const type = pieceType(p);
    const name = NOTE_NAME[side][type];
    const x = from % 9;
    const y = from / 9 | 0;
    const nx = to % 9;
    const ny = to / 9 | 0;
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
      tail = (forward ? "\u9032" : "\u9000") + fileLabel(side, nx);
    } else if (nx !== x) {
      tail = "\u5E73" + fileLabel(side, nx);
    } else {
      tail = (forward ? "\u9032" : "\u9000") + stepLabel(side, Math.abs(ny - y));
    }
    return head + tail;
  }
  function positionKey(board, side) {
    let s = "";
    for (let i = 0; i < 90; i++) s += String.fromCharCode(board[i] + 32);
    return s + (side === RED ? "r" : "b");
  }
  function judgeRepetition(keys, movers, gaveCheck) {
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
    if (redPerp && !blackPerp) return { type: "loss", loser: RED, reason: "\u9577\u5C07" };
    if (blackPerp && !redPerp) return { type: "loss", loser: BLACK, reason: "\u9577\u5C07" };
    return { type: "draw", reason: "\u4E09\u6B21\u91CD\u8907" };
  }
  function sameBoard(a, b) {
    for (let i = 0; i < 90; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // js/banqi.js
  var COLS = 8;
  var ROWS = 4;
  var CELLS = COLS * ROWS;
  var RANK = { [K]: 7, [A]: 6, [E]: 5, [R]: 4, [H]: 3, [C]: 2, [P]: 1 };
  function emptyBanqi() {
    return {
      pieces: new Uint8Array(CELLS),
      face: new Uint8Array(CELLS),
      turn: 0,
      owner: [null, null],
      noCapture: 0,
      over: null
    };
  }
  function newBanqi(rng = Math.random) {
    const state2 = emptyBanqi();
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
      state2.pieces[i] = bag[i];
      state2.face[i] = 1;
    }
    return state2;
  }
  function cloneBanqi(state2) {
    return {
      pieces: state2.pieces.slice(),
      face: state2.face.slice(),
      turn: state2.turn,
      owner: state2.owner.slice(),
      noCapture: state2.noCapture,
      over: state2.over ? { ...state2.over } : null
    };
  }
  function on(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }
  function idx(x, y) {
    return y * COLS + x;
  }
  function colorOfPlayer(state2, player) {
    if (state2.owner[RED] === player) return RED;
    if (state2.owner[BLACK] === player) return BLACK;
    return -1;
  }
  function owns(state2, index) {
    if (state2.face[index] !== 2) return false;
    const side = pieceSide(state2.pieces[index]);
    return state2.owner[side] === state2.turn;
  }
  function canTake(attacker, defender) {
    const at = pieceType(attacker);
    const dt = pieceType(defender);
    if (at === C) return false;
    if (at === P && dt === K) return true;
    if (at === K && dt === P) return false;
    return RANK[at] >= RANK[dt];
  }
  function cannonCaptureTargets(state2, x, y) {
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let cx = x + dx;
      let cy = y + dy;
      let seen = false;
      while (on(cx, cy)) {
        const i = idx(cx, cy);
        if (state2.pieces[i] === 0) {
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
        if (state2.face[i] === 2 && pieceSide(state2.pieces[i]) !== pieceSide(state2.pieces[idx(x, y)])) {
          out.push(i);
        }
        break;
      }
    }
    return out;
  }
  function banqiMoves(state2) {
    if (state2.over) return [];
    const moves = [];
    for (let i = 0; i < CELLS; i++) {
      if (state2.face[i] === 1) moves.push({ kind: "flip", index: i });
    }
    for (let i = 0; i < CELLS; i++) {
      if (!owns(state2, i)) continue;
      const x = i % COLS;
      const y = i / COLS | 0;
      const p = state2.pieces[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!on(nx, ny)) continue;
        const t = idx(nx, ny);
        if (state2.pieces[t] === 0) moves.push({ kind: "move", from: i, to: t });
        else if (state2.face[t] === 2 && pieceSide(state2.pieces[t]) !== pieceSide(p) && canTake(p, state2.pieces[t])) {
          moves.push({ kind: "move", from: i, to: t });
        }
      }
      if (pieceType(p) === C) {
        for (const t of cannonCaptureTargets(state2, x, y)) moves.push({ kind: "move", from: i, to: t });
      }
    }
    return moves;
  }
  function applyBanqi(state2, move) {
    const next = cloneBanqi(state2);
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
  function playerHasPiece(state2, player) {
    for (let i = 0; i < CELLS; i++) {
      if (state2.face[i] === 2 && state2.owner[pieceSide(state2.pieces[i])] === player) return true;
    }
    return false;
  }
  function judgeBanqi(state2) {
    if (state2.noCapture >= 50) return { type: "draw", reason: "\u4E94\u5341\u6B65\u672A\u5403\u5B50" };
    if (state2.owner[RED] == null) return null;
    if (banqiMoves(state2).length > 0) return null;
    const loser = state2.turn;
    return {
      type: "loss",
      loser,
      reason: playerHasPiece(state2, loser) ? "\u7121\u8DEF\u53EF\u8D70" : "\u5B50\u529B\u5403\u5149"
    };
  }
  function material(state2, player) {
    let score = 0;
    for (let i = 0; i < CELLS; i++) {
      if (state2.face[i] !== 2) continue;
      if (state2.owner[pieceSide(state2.pieces[i])] !== player) continue;
      score += RANK[pieceType(state2.pieces[i])] * 10;
    }
    return score;
  }
  function banqiValue(state2, rootPlayer) {
    if (state2.over) {
      if (state2.over.type === "draw") return 0;
      return state2.over.loser === rootPlayer ? -1e3 : 1e3;
    }
    const foe = rootPlayer === 0 ? 1 : 0;
    return material(state2, rootPlayer) - material(state2, foe);
  }
  function searchBanqi(state2, depth, rootPlayer) {
    if (depth === 0 || state2.over || state2.owner[RED] == null) return banqiValue(state2, rootPlayer);
    const moves = banqiMoves(state2);
    const ordered = moves.map((m, i) => ({ m, i, c: m.kind === "move" && state2.pieces[m.to] ? RANK[pieceType(state2.pieces[m.to])] : 0 })).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, 12).map((row) => row.m);
    if (state2.turn === rootPlayer) {
      let best2 = -Infinity;
      for (const m of ordered) best2 = Math.max(best2, searchBanqi(applyBanqi(state2, m), depth - 1, rootPlayer));
      return best2;
    }
    let best = Infinity;
    for (const m of ordered) best = Math.min(best, searchBanqi(applyBanqi(state2, m), depth - 1, rootPlayer));
    return best;
  }
  function chooseBanqiMove(state2, level) {
    const moves = banqiMoves(state2);
    if (moves.length === 0) return null;
    const captures = moves.filter((m) => m.kind === "move" && state2.pieces[m.to] !== 0);
    if (level <= 1 || state2.owner[RED] == null) {
      const pool2 = captures.length > 0 && Math.random() < 0.8 ? captures : moves;
      return pool2[Math.floor(Math.random() * pool2.length)];
    }
    const depth = level >= 3 ? 2 : 1;
    const pool = moves.map((m, i) => ({ m, i, c: m.kind === "move" && state2.pieces[m.to] ? 1 : 0 })).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, 16).map((row) => row.m);
    let bestScore = -Infinity;
    let best = [];
    for (const m of pool) {
      const score = searchBanqi(applyBanqi(state2, m), depth - 1, state2.turn);
      if (score > bestScore) {
        bestScore = score;
        best = [m];
      } else if (score === bestScore) best.push(m);
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  // js/ai.js
  var VALUE = {
    [K]: 1e4,
    [R]: 900,
    [C]: 450,
    [H]: 400,
    [E]: 180,
    [A]: 180,
    [P]: 60
  };
  var BOOK = [
    { from: 7 * 9 + 7, to: 7 * 9 + 4 },
    { from: 7 * 9 + 1, to: 7 * 9 + 4 },
    { from: 9 * 9 + 7, to: 7 * 9 + 6 },
    { from: 9 * 9 + 1, to: 7 * 9 + 2 },
    { from: 6 * 9 + 6, to: 5 * 9 + 6 },
    { from: 6 * 9 + 2, to: 5 * 9 + 2 }
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
  function evaluate(board) {
    let score = 0;
    for (let i = 0; i < 90; i++) {
      const p = board[i];
      if (p === 0) continue;
      const side = pieceSide(p);
      const type = pieceType(p);
      const x = i % 9;
      const y = i / 9 | 0;
      let v = VALUE[type] + pst(type, side, x, y);
      if (type === P && (side === RED && y <= 4 || side === BLACK && y >= 5)) v += 40;
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
    return moves.map((m, i) => ({ m, i, s: moveScore(board, m) })).sort((a, b) => b.s - a.s || a.i - b.i).map((row) => row.m);
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
  function quiesce(board, side, alpha, beta, budget, ply) {
    stopSearch(budget);
    const all = legalMoves(board, side);
    if (all.length === 0) return -1e5 + ply;
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
    if (moves.length === 0) return -1e5 + ply;
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
    const budget = { nodes: 0, limit: depth >= 3 ? 25e4 : 12e4, deadline, rootDepth: depth };
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
  function bestMove(board, side, level) {
    const moves = legalMoves(board, side);
    if (moves.length === 0) return null;
    if (level <= 1) {
      const booked = bookMove(board, side);
      if (booked && Math.random() < 0.85) return booked;
      const ranked = moves.map((m) => {
        const next = applyMove(board, m.from, m.to);
        const e = evaluate(next);
        const score = side === RED ? e : -e;
        const checkBonus = inCheck(next, other(side)) ? 40 : 0;
        return { m, score: score + checkBonus };
      }).sort((a, b) => b.score - a.score);
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

  // js/game.js
  function newXiangqi({ vs = "ai", level = 2, humanSide = RED } = {}) {
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
      hint: null
    };
  }
  function newDark({ vs = "ai", level = 2 } = {}) {
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
      hint: null
    };
  }
  function remember(state2) {
    if (state2.mode === "xiangqi") {
      state2.past.push({
        board: state2.board.slice(),
        side: state2.side,
        noCapture: state2.noCapture,
        record: state2.record.slice(),
        keys: state2.keys.slice(),
        movers: state2.movers.slice(),
        checks: state2.checks.slice(),
        last: state2.last,
        over: state2.over
      });
    } else {
      state2.past.push({
        banqi: cloneBanqi(state2.banqi),
        record: state2.record.slice(),
        last: state2.last,
        over: state2.over
      });
    }
    if (state2.past.length > 300) state2.past.shift();
  }
  function xiangqiTargets(state2, from) {
    if (state2.over || pieceSide(state2.board[from]) !== state2.side) return [];
    return legalMovesFrom(state2.board, state2.side, from).map((m) => m.to);
  }
  function playXiangqi(state2, from, to) {
    if (state2.over) return false;
    const legal = legalMovesFrom(state2.board, state2.side, from);
    if (!legal.some((m) => m.to === to)) return false;
    remember(state2);
    const note = notation(state2.board, from, to);
    const captured = state2.board[to] !== 0;
    const mover = state2.side;
    const next = applyMove(state2.board, from, to);
    const gave = inCheck(next, other(mover));
    state2.board = next;
    state2.side = other(mover);
    state2.noCapture = captured ? 0 : state2.noCapture + 1;
    state2.record.push(note);
    state2.keys.push(positionKey(next, state2.side));
    state2.movers.push(mover);
    state2.checks.push(gave);
    state2.last = { from, to };
    state2.hint = null;
    state2.over = endOfXiangqi(state2);
    return true;
  }
  function endOfXiangqi(state2) {
    const done = terminal(state2.board, state2.side);
    if (done) return done;
    const rep = judgeRepetition(state2.keys, state2.movers, state2.checks);
    if (rep) return rep;
    if (state2.noCapture >= 120) return { type: "draw", reason: "\u516D\u5341\u56DE\u5408\u672A\u5403\u5B50" };
    return null;
  }
  function banqiTargets(state2, from) {
    if (state2.over) return [];
    return banqiMoves(state2.banqi).filter((m) => m.kind === "move" && m.from === from).map((m) => m.to);
  }
  function playBanqi(state2, move) {
    if (state2.over) return false;
    const legal = banqiMoves(state2.banqi).some((m) => {
      if (m.kind !== move.kind) return false;
      if (m.kind === "flip") return m.index === move.index;
      return m.from === move.from && m.to === move.to;
    });
    if (!legal) return false;
    remember(state2);
    state2.record.push(banqiNote(state2.banqi, move));
    state2.last = move.kind === "flip" ? { index: move.index } : { from: move.from, to: move.to };
    state2.banqi = applyBanqi(state2.banqi, move);
    state2.hint = null;
    state2.over = state2.banqi.over;
    return true;
  }
  function banqiNote(before, move) {
    if (move.kind === "flip") return `\u7FFB${GLYPH[before.pieces[move.index]]}`;
    const name = GLYPH[before.pieces[move.from]];
    if (before.pieces[move.to] !== 0) return `${name}\u5403${GLYPH[before.pieces[move.to]]}`;
    return `${name}\u9032`;
  }
  function undo(state2) {
    const prev = state2.past.pop();
    if (!prev) return false;
    if (state2.mode === "xiangqi") {
      state2.board = prev.board;
      state2.side = prev.side;
      state2.noCapture = prev.noCapture;
      state2.record = prev.record;
      state2.keys = prev.keys;
      state2.movers = prev.movers;
      state2.checks = prev.checks;
    } else {
      state2.banqi = prev.banqi;
    }
    state2.record = prev.record;
    state2.last = prev.last;
    state2.over = prev.over;
    state2.hint = null;
    return true;
  }
  function undoTurn(state2) {
    if (state2.past.length === 0) return false;
    if (state2.mode === "xiangqi" && state2.vs === "ai") {
      const aiSide = state2.humanSide === RED ? BLACK : RED;
      const last = state2.movers[state2.movers.length - 1];
      undo(state2);
      if (last === aiSide && state2.movers.length > 1) undo(state2);
      return true;
    }
    if (state2.mode === "banqi" && state2.vs === "ai") {
      const lastWasAi = state2.banqi.turn === 0 && state2.past.length > 0;
      undo(state2);
      if (lastWasAi && state2.banqi.turn === 1) undo(state2);
      return true;
    }
    return undo(state2);
  }
  function isAiTurn(state2) {
    if (state2.over || state2.vs !== "ai") return false;
    if (state2.mode === "xiangqi") return state2.side !== state2.humanSide;
    return state2.banqi.turn === 1;
  }
  function think(state2) {
    if (state2.mode === "xiangqi") return bestMove(state2.board, state2.side, state2.level);
    return chooseBanqiMove(state2.banqi, state2.level);
  }
  function hintMove(state2) {
    if (state2.over) return null;
    if (state2.mode === "xiangqi") {
      const move2 = bestMove(state2.board, state2.side, state2.level >= 3 ? 2 : Math.max(state2.level, 2));
      if (!move2) return null;
      state2.hint = move2;
      return { move: move2, note: notation(state2.board, move2.from, move2.to) };
    }
    const move = chooseBanqiMove(state2.banqi, Math.max(state2.level, 2));
    state2.hint = move;
    return move ? { move, note: banqiNote(state2.banqi, move) } : null;
  }
  function sideName(side) {
    return side === RED ? "\u7D05\u65B9" : "\u9ED1\u65B9";
  }
  function resultText(state2) {
    const end = state2.over;
    if (!end) return "";
    if (end.type === "draw") return `\u548C\u68CB \xB7 ${end.reason}`;
    if (state2.mode === "banqi") {
      const winner2 = end.loser === 0 ? "\u5F8C\u624B" : "\u5148\u624B";
      return `${winner2}\u52DD \xB7 ${end.reason}`;
    }
    const winner = sideName(other(end.loser));
    if (end.kind === "mate") return `${winner}\u52DD \xB7 \u5C07\u6B7B`;
    if (end.kind === "stalemate") return `${winner}\u52DD \xB7 \u56F0\u6583`;
    return `${winner}\u52DD \xB7 ${end.reason}`;
  }
  function turnText(state2) {
    if (state2.over) return resultText(state2);
    if (state2.mode === "xiangqi") {
      const check = inCheck(state2.board, state2.side) ? " \xB7 \u5C07\u8ECD" : "";
      return `${sideName(state2.side)}\u8D70${check}`;
    }
    const player = state2.banqi.turn === 0 ? "\u5148\u624B" : "\u5F8C\u624B";
    const color = colorOfPlayer(state2.banqi, state2.banqi.turn);
    const who = color < 0 ? player : `${player}\uFF08${sideName(color)}\uFF09`;
    return `${who}\u8D70`;
  }
  function sealText(state2) {
    if (!state2.over) return "";
    if (state2.over.type === "draw") return "\u548C\u68CB";
    if (state2.mode === "banqi") return state2.over.loser === 0 ? "\u5F8C\u624B\u52DD" : "\u5148\u624B\u52DD";
    return state2.over.loser === RED ? "\u9ED1\u52DD" : "\u7D05\u52DD";
  }
  function serialize(state2) {
    if (state2.mode === "xiangqi") {
      return {
        mode: "xiangqi",
        vs: state2.vs,
        level: state2.level,
        humanSide: state2.humanSide,
        board: Array.from(state2.board),
        side: state2.side,
        noCapture: state2.noCapture,
        record: state2.record,
        keys: state2.keys,
        movers: state2.movers,
        checks: state2.checks,
        last: state2.last,
        over: state2.over,
        past: state2.past.map((p) => ({
          board: Array.from(p.board),
          side: p.side,
          noCapture: p.noCapture,
          record: p.record,
          keys: p.keys,
          movers: p.movers,
          checks: p.checks,
          last: p.last,
          over: p.over
        }))
      };
    }
    return {
      mode: "banqi",
      vs: state2.vs,
      level: state2.level,
      record: state2.record,
      last: state2.last,
      over: state2.over,
      banqi: {
        pieces: Array.from(state2.banqi.pieces),
        face: Array.from(state2.banqi.face),
        turn: state2.banqi.turn,
        owner: state2.banqi.owner,
        noCapture: state2.banqi.noCapture,
        over: state2.banqi.over
      },
      past: state2.past.map((p) => ({
        record: p.record,
        last: p.last,
        over: p.over,
        banqi: {
          pieces: Array.from(p.banqi.pieces),
          face: Array.from(p.banqi.face),
          turn: p.banqi.turn,
          owner: p.banqi.owner,
          noCapture: p.banqi.noCapture,
          over: p.banqi.over
        }
      }))
    };
  }
  function asBanqi(raw) {
    return {
      pieces: Uint8Array.from(raw.pieces),
      face: Uint8Array.from(raw.face),
      turn: raw.turn,
      owner: raw.owner.slice(),
      noCapture: raw.noCapture,
      over: raw.over
    };
  }
  function hydrate(data) {
    if (!data || data.mode !== "xiangqi" && data.mode !== "banqi") return null;
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
          over: p.over
        }))
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
        over: p.over
      }))
    };
  }

  // js/board.js
  var FILES = "abcdefghi";
  var TYPE_CODE = ["K", "A", "B", "N", "R", "C", "P"];
  var ART = {
    K: "king",
    A: "advisor",
    B: "elephant",
    N: "horse",
    R: "chariot",
    C: "cannon",
    P: "soldier"
  };
  function indexToSquare(index) {
    const x = index % 9;
    const y = index / 9 | 0;
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
  function createStage(host, { onPick: onPick2, onCue, canDrag: canDrag2, canDrop: canDrop2, commitDrag: commitDrag2 }) {
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
        return canDrag2(squareToIndex(source));
      },
      onDrop(source, target) {
        if (source === target || target === "offboard") return "snapback";
        suppressClick = true;
        const from = squareToIndex(source);
        const to = squareToIndex(target);
        if (!canDrop2(from, to)) {
          onPick2(from);
          return "snapback";
        }
        skipAnim = true;
        commitDrag2(from, to);
      }
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
      const heightFor = (value) => (Math.max(value, cols) - 1) / cols * rows + border;
      if (heightFor(width) > h) width = (h - border) * cols / rows + 1;
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
    function paintBanqi(state2) {
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
        const piece2 = state2.banqi.pieces[i];
        if (state2.banqi.face[i] !== 2) {
          cell.replaceChildren(Object.assign(document.createElement("span"), { className: "token" }));
          continue;
        }
        const img = document.createElement("img");
        img.className = "fig";
        img.alt = "";
        img.src = pieceSrc(pieceCode(piece2));
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
        onPick2(squareToIndex(square.dataset.square));
        return;
      }
      const cell = event.target.closest?.("[data-i]");
      if (!cell) return;
      onPick2(Number(cell.dataset.i));
    });
    window.addEventListener("resize", () => {
      if (mode === "xiangqi") fitXiangqi();
      else if (current) paintBanqi(current);
      applyGuides();
    });
    function layout(state2) {
      animGen += 1;
      current = state2;
      mode = state2.mode;
      host.dataset.kind = mode;
      if (mode === "xiangqi") {
        bq.hidden = true;
        xq.hidden = false;
        fitXiangqi();
        widget.position(positionFromBoard(state2.board), false);
        return;
      }
      xq.hidden = true;
      bq.hidden = false;
      paintBanqi(state2);
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
              { transform: "none" }
            ],
            { duration: (motion.capture ? 280 : 220) / speedMul, easing: "ease-out" }
          );
          await anim.finished.catch(() => {
          });
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
      setLabels() {
      },
      setCloseup() {
      },
      setSpeed(value) {
        speedMul = value || 1;
        config.moveSpeed = speedMul > 1 ? 110 : 240;
      },
      setQuality() {
      },
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
        const frame2 = host.getBoundingClientRect();
        return rect.width > frame2.width * 0.7 && rect.top >= frame2.top - 2 && rect.bottom <= frame2.bottom + 2;
      },
      debugFrame() {
        const el = mode === "xiangqi" ? xq.querySelector(".board-1ef78") : bq;
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, seated };
      }
    };
  }

  // js/sound.js
  var LINES = {
    m: ["\u5C07\u9032", "\u8B77\u99D5", "\u8C61\u8E0F", "\u99AC\u51FA", "\u8ECA\u51FA", "\u70AE\u884C", "\u5175\u9032"],
    h: ["\u62FF\u4E0B", "\u65AC\u4E86", "\u93AE\u4F4F", "\u8E0F\u788E", "\u885D\u6BBA", "\u8F5F\u788E", "\u64D2\u4E0B"],
    flip: "\u7FFB\u5B50",
    fire: "\u958B\u70AE"
  };
  var enabled = true;
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  function setSoundEnabled(on2) {
    enabled = on2;
    if (!on2 && window.speechSynthesis) speechSynthesis.cancel();
  }
  function context() {
    if (ctx) return ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 4e-3;
    comp.release.value = 0.16;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }
  function unlock() {
    const audio = context();
    if (audio.state === "suspended") audio.resume();
  }
  function noise() {
    const audio = context();
    if (noiseBuf) return noiseBuf;
    const n = audio.sampleRate;
    noiseBuf = audio.createBuffer(1, n, audio.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < n; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = brown * 3.5;
    }
    return noiseBuf;
  }
  function burst(at, duration, freq, q, peak) {
    const audio = context();
    const src = audio.createBufferSource();
    src.buffer = noise();
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(1e-4, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(1e-3, peak), at + 0.012);
    gain.gain.exponentialRampToValueAtTime(1e-4, at + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(at);
    src.stop(at + duration + 0.02);
  }
  function tone(at, freq, endFreq, duration, type, peak) {
    const audio = context();
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freq), at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), at + duration);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(1e-4, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(1e-3, peak), at + 0.012);
    gain.gain.exponentialRampToValueAtTime(1e-4, at + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
  function say(name, text) {
    const clip = new Audio(`assets/voice/${name}.wav`);
    clip.volume = 1;
    clip.addEventListener("error", () => speak(text), { once: true });
    clip.play().catch(() => speak(text));
  }
  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 0.9;
    utterance.pitch = 0.65;
    utterance.volume = 1;
    const voice = speechSynthesis.getVoices().find((item) => /Zhiwei|志偉|Yating|Hanhan|zh-TW/i.test(`${item.name} ${item.lang}`));
    if (voice) utterance.voice = voice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }
  function moveBody(type, at, cannon) {
    if (cannon) {
      tone(at, 140, 70, 0.22, "triangle", 0.08);
      burst(at, 0.18, 500, 0.6, 0.08);
      return;
    }
    if (type === 0) {
      tone(at, 98, 70, 0.4, "sine", 0.16);
      tone(at + 0.02, 196, 140, 0.28, "triangle", 0.04);
    } else if (type === 1) {
      burst(at, 0.16, 900, 0.7, 0.07);
      tone(at, 280, 190, 0.16, "triangle", 0.05);
    } else if (type === 2) {
      tone(at, 62, 40, 0.24, "sine", 0.2);
      tone(at + 0.26, 58, 36, 0.24, "sine", 0.2);
      burst(at, 0.16, 180, 0.5, 0.12);
      burst(at + 0.26, 0.16, 160, 0.5, 0.12);
    } else if (type === 3) {
      for (let i = 0; i < 3; i++) {
        tone(at + i * 0.11, 160, 90, 0.08, "triangle", 0.09);
        burst(at + i * 0.11, 0.06, 280, 0.8, 0.08);
      }
    } else if (type === 4) {
      tone(at, 52, 40, 0.4, "sine", 0.14);
      burst(at, 0.42, 220, 0.4, 0.16);
    } else if (type === 6) {
      tone(at, 220, 150, 0.08, "triangle", 0.05);
      tone(at + 0.12, 210, 140, 0.08, "triangle", 0.05);
      burst(at, 0.05, 1600, 0.7, 0.04);
      burst(at + 0.12, 0.05, 1600, 0.7, 0.04);
    } else {
      burst(at, 0.2, 480, 0.5, 0.06);
    }
  }
  function hitBody(type, cannon, at) {
    const heavy = cannon || type === 0 || type === 2 || type === 4;
    tone(at, heavy ? 82 : 130, 34, heavy ? 0.5 : 0.28, "sine", heavy ? 0.3 : 0.16);
    burst(at, heavy ? 0.45 : 0.22, heavy ? 220 : 640, 0.5, heavy ? 0.28 : 0.14);
    burst(at, 0.07, 1800, 0.4, cannon ? 0.18 : 0.08);
    if (cannon) {
      tone(at, 64, 30, 0.7, "sine", 0.34);
      burst(at + 0.04, 0.55, 140, 0.35, 0.2);
    }
  }
  function playCue(cue) {
    if (!cue) return;
    if (cue.kind === "unlock") {
      unlock();
      return;
    }
    if (!enabled) return;
    unlock();
    const at = context().currentTime + 0.012;
    const type = cue.type ?? 6;
    if (cue.kind === "move") {
      moveBody(type, at, cue.cannon && cue.capture);
      if (cue.voice === false) return;
      if (cue.cannon && cue.capture) say("fire", LINES.fire);
      else say(`m${type}`, LINES.m[type]);
    } else if (cue.kind === "hit") {
      hitBody(type, !!cue.cannon, at);
      if (cue.voice !== false) say(`h${type}`, LINES.h[type]);
    } else if (cue.kind === "flip") {
      burst(at, 0.16, 640, 0.7, 0.08);
      tone(at, 240, 160, 0.14, "triangle", 0.05);
      say("flip", LINES.flip);
    }
  }

  // js/main.js
  var SAVE_KEY = "juzhongju-v1";
  var SOUND_KEY = "juzhongju-sound";
  var VIEW_KEY = "juzhongju-view";
  var statusEl = document.querySelector("#status");
  var hintEl = document.querySelector("#hintline");
  var recordEl = document.querySelector("#record");
  var sealEl = document.querySelector("#seal");
  var continueBtn = document.querySelector("#btn-continue");
  var canvas = document.querySelector("#board");
  var state = null;
  var selected = null;
  var hintNote = "";
  var busy = false;
  var thinkGen = 0;
  var silence = false;
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
    }
  }
  var soundOn = storageGet(SOUND_KEY) !== "0";
  function viewPrefs() {
    try {
      return JSON.parse(storageGet(VIEW_KEY) || "{}");
    } catch {
      return {};
    }
  }
  var prefs = viewPrefs();
  var optLabel = document.querySelector("#opt-label");
  var optCloseup = document.querySelector("#opt-closeup");
  var optFast = document.querySelector("#opt-fast");
  var optLite = document.querySelector("#opt-lite");
  var optSpin = document.querySelector("#opt-spin");
  optLabel.checked = prefs.labels !== false;
  optCloseup.checked = prefs.closeup !== false;
  optFast.checked = !!prefs.fast;
  optLite.checked = !!prefs.lite;
  optSpin.checked = !!prefs.spin;
  function savePrefs() {
    storageSet(
      VIEW_KEY,
      JSON.stringify({
        labels: optLabel.checked,
        closeup: optCloseup.checked,
        fast: optFast.checked,
        lite: optLite.checked,
        spin: optSpin.checked
      })
    );
  }
  function options() {
    return {
      mode: document.querySelector("input[name=mode]:checked").value,
      vs: document.querySelector("input[name=vs]:checked").value,
      level: Number(document.querySelector("input[name=level]:checked").value),
      humanSide: Number(document.querySelector("input[name=side]:checked").value)
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
  var stage = null;
  statusEl.textContent = "\u68CB\u5B50\u5C31\u4F4D\u4E2D";
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
      type: pieceType(attacker)
    };
  }
  function render() {
    stage.showGuides({
      selected,
      targets: selected == null ? [] : targetsOf(selected),
      last: state.last,
      hint: state.hint,
      occupied
    });
    statusEl.textContent = busy && isAiTurn(state) ? "\u601D\u8003\u4E2D" : turnText(state);
    hintEl.textContent = hintNote ? `\u63D0\u793A\uFF1A${hintNote}` : "";
    const seal = sealText(state);
    sealEl.hidden = !seal;
    sealEl.textContent = seal || "";
    recordEl.innerHTML = state.record.map((note, i) => {
      const tag = state.mode === "xiangqi" ? i % 2 === 0 ? "\u7D05" : "\u9ED1" : i % 2 === 0 ? "\u5148" : "\u5F8C";
      return `<li><span>${tag}</span>${note}</li>`;
    }).join("");
    recordEl.scrollTop = recordEl.scrollHeight;
    document.querySelector("#btn-undo").disabled = busy || state.past.length === 0;
    document.querySelector("#btn-hint").disabled = busy || !!state.over || isAiTurn(state);
    document.querySelector("#btn-sound").textContent = soundOn ? "\u97F3\u6548\u958B" : "\u97F3\u6548\u95DC";
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
  Promise.resolve().then(() => createStage(canvas, { onPick, onCue: playCue, canDrag, canDrop, commitDrag })).then((ready) => {
    stage = ready;
    setSoundEnabled(soundOn);
    if (new URLSearchParams(location.search).has("test")) {
      window.__juzhong = {
        projectIndex: (index) => stage.projectIndex(index),
        projectSquare: (file, rank) => stage.projectSquare(file, rank),
        boardInside: () => stage.boardInside(),
        debugFrame: () => stage.debugFrame()
      };
    }
    stage.setLabels(optLabel.checked);
    stage.setCloseup(optCloseup.checked);
    stage.setSpeed(optFast.checked ? 1.8 : 1);
    stage.setQuality(!optLite.checked);
    continueBtn.hidden = !storageGet(SAVE_KEY);
    begin(makeMatch());
    document.body.dataset.ready = "1";
    document.getElementById("boot-warn").hidden = true;
  }).catch((error) => {
    console.error(error);
    const warn = document.getElementById("boot-warn");
    warn.hidden = false;
    warn.textContent = "\u756B\u9762\u6C92\u6709\u8F09\u5165\u3002\u8ACB\u91CD\u65B0\u96D9\u64CA\u555F\u52D5.bat\u3002";
  });
})();
