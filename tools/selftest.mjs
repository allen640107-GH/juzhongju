import assert from "node:assert/strict";
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
  judgeRepetition,
  kingsFace,
  legalMoves,
  notation,
  perftDetail,
  piece,
  pieceSide,
  pseudoMoves,
  startingBoard,
  terminal,
} from "../js/xiangqi.js";
import { bestMove } from "../js/ai.js";
import { hydrate, newDark, newXiangqi, playBanqi, playXiangqi, serialize, undoTurn } from "../js/game.js";
import { applyBanqi, banqiMoves, canTake, emptyBanqi, newBanqi } from "../js/banqi.js";

const start = startingBoard();
const d1 = perftDetail(start, RED, 1);
assert.equal(d1.nodes, 44, `起始應有 44 步，得到 ${d1.nodes}`);
assert.equal(d1.captures, 2, `起始應有 2 步吃子，得到 ${d1.captures}`);
assert.equal(d1.checks, 0);

const d2 = perftDetail(start, RED, 2);
assert.equal(d2.nodes, 1920, `第二層應有 1920，得到 ${d2.nodes}`);
assert.equal(d2.captures, 72);
assert.equal(d2.checks, 6);

function move(board, fromX, fromY, toX, toY) {
  return legalMoves(board, pieceSide(board[fromY * 9 + fromX])).find(
    (m) => m.from === fromY * 9 + fromX && m.to === toY * 9 + toX,
  );
}

function geo(board, fromX, fromY, toX, toY) {
  return pseudoMoves(board, pieceSide(board[fromY * 9 + fromX])).find(
    (m) => m.from === fromY * 9 + fromX && m.to === toY * 9 + toX,
  );
}

assert.equal(notation(start, 7 * 9 + 7, 7 * 9 + 4), "炮二平五");
assert.equal(notation(start, 9 * 9 + 7, 7 * 9 + 6), "馬二進三");
assert.ok(move(start, 7, 7, 4, 7), "炮二平五應合法");
assert.ok(move(start, 1, 7, 1, 0), "炮可隔黑砲打掉底馬");
assert.equal(notation(start, 7 * 9 + 1, 0 * 9 + 1), "炮八進七");

const afterCannon = applyMove(start, 7 * 9 + 7, 7 * 9 + 4);
assert.equal(notation(afterCannon, 0 * 9 + 7, 2 * 9 + 6), "馬8進7");

function empty() {
  return new Uint8Array(90);
}

{
  const b = empty();
  b[9 * 9 + 4] = piece(RED, K);
  b[0 * 9 + 4] = piece(BLACK, K);
  b[5 * 9 + 4] = piece(RED, P);
  assert.equal(kingsFace(b), false);
  const away = applyMove(b, 5 * 9 + 4, 5 * 9 + 3);
  assert.equal(kingsFace(away), true);
  assert.equal(inCheck(away, RED), true);
  assert.equal(move(b, 4, 5, 3, 5), undefined, "挪開中間的兵會照面，不能走");
}

{
  const b = empty();
  b[9 * 9 + 1] = piece(RED, H);
  b[8 * 9 + 1] = piece(RED, P);
  assert.equal(geo(b, 1, 9, 0, 7), undefined, "直向馬腿被兵擋住");
  assert.equal(geo(b, 1, 9, 2, 7), undefined, "直向馬腿被兵擋住");
  assert.ok(geo(b, 1, 9, 3, 8), "橫向馬腿是空的，仍可走");
  b[8 * 9 + 1] = 0;
  b[9 * 9 + 2] = piece(RED, E);
  assert.equal(geo(b, 1, 9, 3, 8), undefined, "橫向馬腿被相擋住");
  assert.ok(geo(b, 1, 9, 2, 7));
}

{
  const b = empty();
  b[9 * 9 + 2] = piece(RED, E);
  b[8 * 9 + 3] = piece(RED, P);
  assert.equal(geo(b, 2, 9, 4, 7), undefined, "塞象眼");
  assert.ok(geo(b, 2, 9, 0, 7), "另一隻眼是通的");
  b[5 * 9 + 4] = piece(RED, E);
  assert.equal(geo(b, 4, 5, 2, 3), undefined, "相不能過河");
  assert.equal(geo(b, 4, 5, 6, 3), undefined, "相不能過河");
  assert.ok(geo(b, 4, 5, 2, 7), "退回己方河沿仍可走");
}

{
  const b = empty();
  b[8 * 9 + 4] = piece(RED, A);
  const dests = pseudoMoves(b, RED).map((m) => m.to).sort();
  assert.deepEqual(dests, [7 * 9 + 3, 7 * 9 + 5, 9 * 9 + 3, 9 * 9 + 5].sort());
}

{
  const b = empty();
  b[6 * 9 + 4] = piece(RED, P);
  assert.deepEqual(
    pseudoMoves(b, RED).map((m) => m.to),
    [5 * 9 + 4],
  );
  const crossed = empty();
  crossed[4 * 9 + 4] = piece(RED, P);
  const dest = pseudoMoves(crossed, RED).map((m) => m.to).sort();
  assert.deepEqual(dest, [4 * 9 + 3, 4 * 9 + 5, 3 * 9 + 4].sort());
}

{
  const b = empty();
  b[0] = piece(BLACK, K);
  b[1] = piece(RED, R);
  b[9 + 5] = piece(RED, R);
  b[2 * 9 + 3] = piece(RED, R);
  b[9 * 9 + 3] = piece(RED, K);
  const end = terminal(b, BLACK);
  assert.equal(end?.kind, "mate");
  assert.equal(end?.loser, BLACK);
}

{
  const b = empty();
  b[0 * 9 + 4] = piece(BLACK, K);
  b[0 * 9 + 3] = piece(RED, H);
  b[0 * 9 + 5] = piece(RED, C);
  b[1 * 9 + 4] = piece(RED, H);
  b[9 * 9 + 3] = piece(RED, R);
  b[9 * 9 + 5] = piece(RED, R);
  b[9 * 9 + 4] = piece(RED, R);
  assert.equal(inCheck(b, BLACK), false);
  const end = terminal(b, BLACK);
  assert.equal(end?.kind, "stalemate");
  assert.equal(end?.loser, BLACK);
}

{
  const draw = judgeRepetition(
    ["a", "b", "a", "b", "a"],
    [null, RED, BLACK, RED, BLACK],
    [null, false, false, false, false],
  );
  assert.equal(draw.type, "draw");
  const loss = judgeRepetition(
    ["a", "b", "a", "b", "a"],
    [null, RED, BLACK, RED, BLACK],
    [null, true, false, true, false],
  );
  assert.equal(loss.type, "loss");
  assert.equal(loss.loser, RED);
  assert.equal(loss.reason, "長將");
}

{
  const b = empty();
  b[9 * 9 + 4] = piece(RED, C);
  b[7 * 9 + 4] = piece(RED, A);
  b[4 * 9 + 4] = piece(BLACK, P);
  assert.ok(geo(b, 4, 9, 4, 4), "炮隔一子可吃");
  const blocked = empty();
  blocked[9 * 9 + 4] = piece(RED, C);
  blocked[8 * 9 + 4] = piece(RED, P);
  blocked[7 * 9 + 4] = piece(RED, A);
  blocked[4 * 9 + 4] = piece(BLACK, P);
  assert.equal(geo(blocked, 4, 9, 4, 4), undefined, "兩座炮架不能吃");
}

assert.equal(canTake(piece(RED, P), piece(BLACK, K)), true);
assert.equal(canTake(piece(RED, K), piece(BLACK, P)), false);
assert.equal(canTake(piece(RED, R), piece(BLACK, H)), true);
assert.equal(canTake(piece(RED, H), piece(BLACK, R)), false);
assert.equal(canTake(piece(RED, H), piece(BLACK, A)), false);
assert.equal(canTake(piece(RED, A), piece(BLACK, H)), true);
assert.equal(canTake(piece(RED, R), piece(BLACK, A)), false);
assert.equal(canTake(piece(RED, C), piece(BLACK, P)), false);

{
  const game = newBanqi(() => 0.5);
  assert.equal([...game.pieces].filter(Boolean).length, 32);
  assert.equal([...game.face].every((f) => f === 1), true);
  const flips = banqiMoves(game).filter((m) => m.kind === "flip");
  assert.equal(flips.length, 32);
  const flipped = applyBanqi(game, { kind: "flip", index: 0 });
  const side = pieceSide(flipped.pieces[0]);
  assert.equal(flipped.owner[side], 0);
  assert.equal(flipped.owner[side === RED ? BLACK : RED], 1);
}

{
  const state = emptyBanqi();
  state.pieces[0] = piece(RED, C);
  state.face[0] = 2;
  state.pieces[1] = piece(RED, P);
  state.face[1] = 2;
  state.pieces[3] = piece(BLACK, K);
  state.face[3] = 2;
  state.owner = [0, 1];
  state.turn = 0;
  const shots = banqiMoves(state).filter((m) => m.kind === "move" && m.from === 0 && m.to === 3);
  assert.equal(shots.length, 1, "砲隔一子可打將");
  const adjacent = banqiMoves(state).filter((m) => m.kind === "move" && m.from === 0 && m.to === 1);
  assert.equal(adjacent.length, 0, "砲不能吃自己人，也不能平吃");
}

{
  const game = newXiangqi({ vs: "human" });
  assert.equal(playXiangqi(game, 7 * 9 + 7, 7 * 9 + 4), true);
  assert.equal(game.record[0], "炮二平五");
  assert.equal(game.side, BLACK);
  assert.equal(playXiangqi(game, 7 * 9 + 7, 7 * 9 + 3), false);
  assert.equal(undoTurn(game), true);
  assert.equal(game.side, RED);
  assert.equal(game.record.length, 0);
  const restored = hydrate(serialize(game));
  assert.equal(restored.board[7 * 9 + 7], game.board[7 * 9 + 7]);
  assert.equal(restored.side, RED);
}

{
  const dark = newDark({ vs: "human" });
  assert.equal(playBanqi(dark, { kind: "flip", index: 0 }), true);
  assert.equal(dark.record[0].startsWith("翻"), true);
  assert.equal(dark.banqi.turn, 1);
  assert.equal(undoTurn(dark), true);
  assert.equal(dark.banqi.turn, 0);
  assert.equal(dark.banqi.face[0], 1);
  assert.equal(dark.record.length, 0);
}

{
  const t0 = Date.now();
  const m = bestMove(start, RED, 3);
  const ms = Date.now() - t0;
  assert.ok(m && move(start, m.from % 9, (m.from / 9) | 0, m.to % 9, (m.to / 9) | 0));
  const note = notation(start, m.from, m.to);
  assert.equal(start[m.to], 0, `開局不該吃子，卻下了 ${note}`);
  console.log(`高手首著 ${note}，${ms} ms`);
  assert.ok(ms < 5000, "高手思考應在 5 秒內");
}

console.log("橘中局規則測試通過");
