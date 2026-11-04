/**
 * 立體棋桌。
 *
 * 座標只在這裡換算一次：
 *   路 file 0 → 世界 −X（鏡頭在 +Z 時，這是畫面左側）
 *   橫 rank 0（黑方底線）→ 世界 −Z（鏡頭在 +Z 時，這是遠處）
 *   橫 rank 9（紅方底線）→ 世界 +Z（鏡頭在 +Z 時，這是近處）
 * 棋子圖卡的正面是本地 +Z，每幀只改圖卡 yaw，讓 +Z 朝向鏡頭。
 * 紅方根節點 yaw 0。黑方根節點 yaw π，蓋著的木罩才用得到。
 */
import * as THREE from "three";
import { COLS, ROWS } from "./banqi.js";
import { A, C, E, GLYPH, H, K, P, R, RED, pieceSide, pieceType } from "./xiangqi.js";

const S = 1;
const MARGIN = 0.95;
const BOARD_W = 8 * S + MARGIN * 2;
const BOARD_D = 9 * S + MARGIN * 2;
const BANQI_S = 1.15;
const HOME_YAW = 0;
const HOME_PITCH = 0.82;
const PAD_HOME = 0.965;
const ART_NAME = ["king", "advisor", "elephant", "horse", "chariot", "cannon", "soldier"];
const CARD_H = [2.05, 1.88, 1.72, 1.95, 1.62, 1.7, 1.48];
const CARD_MAX_W = 1.28;
const SURFACE = 0.028;
const BOARD_FACE = "assets/board/face.jpg";
const BOARD_FRAME = "assets/board/table.jpg";
const STAGE = 0x120c14;

function squareToWorld(file, rank) {
  return new THREE.Vector3((file - 4) * S, 0.028, (rank - 4.5) * S);
}

function worldToSquare(point) {
  return {
    file: Math.round(point.x / S + 4),
    rank: Math.round(point.z / S + 4.5),
  };
}

function banqiToWorld(x, y) {
  return new THREE.Vector3((x - (COLS - 1) / 2) * BANQI_S, 0.028, (y - (ROWS - 1) / 2) * BANQI_S);
}

function worldToBanqi(point) {
  return {
    x: Math.round(point.x / BANQI_S + (COLS - 1) / 2),
    y: Math.round(point.z / BANQI_S + (ROWS - 1) / 2),
  };
}

function ease(u) {
  return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
}

function angDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function travelPose(type, u, capture) {
  const heavy = type === K || type === E || type === R || type === C;
  let hop = 0;
  let rx = 0;
  let rz = 0;
  let squat = 0;
  let back = 0;
  if (u < 0.18) {
    const k = Math.sin((u / 0.18) * Math.PI);
    squat = k * (heavy ? 0.72 : 0.42);
    rx = squat * 0.22;
    back = squat * 0.06;
  } else if (u < 0.76) {
    const k = (u - 0.18) / 0.58;
    if (type === H) {
      const gallop = Math.sin(k * Math.PI * 2);
      hop = Math.abs(gallop) * (capture ? 1.05 : 0.78);
      rx = -gallop * 0.48;
      rz = Math.sin(k * Math.PI * 4) * 0.06;
    } else if (type === R) {
      const arc = Math.sin(k * Math.PI);
      hop = arc * (capture ? 0.22 : 0.1);
      rx = -arc * 0.08;
      rz = Math.sin(k * 18) * 0.015;
    } else if (type === C) {
      const recoil = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) : 0;
      hop = Math.sin(k * Math.PI) * (capture ? 0.34 : 0.16);
      rx = recoil * 0.5;
      back = recoil * 0.22;
    } else {
      const arc = Math.sin(k * Math.PI);
      const lift = type === E ? 0.55 : type === K ? 0.48 : type === A ? 0.5 : 0.42;
      hop = arc * lift * (capture ? 1.28 : 1);
      rx = -arc * (type === E ? 0.16 : 0.32);
      rz = type === A ? Math.sin(k * Math.PI * 2) * 0.16 : 0;
    }
  } else {
    const k = (u - 0.76) / 0.24;
    squat = Math.sin(k * Math.PI) * (capture || heavy ? 0.95 : 0.58);
    rx = squat * 0.16;
  }
  return { hop, rx, rz, squat, back };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}

async function loadArt() {
  const art = { [RED]: {}, 1: {} };
  await Promise.all(
    ART_NAME.map(async (name, type) => {
      for (const [side, folder] of [
        [RED, "red"],
        [1, "black"],
      ]) {
        const image = await loadImage(`assets/pieces/art/${folder}/${name}.png?v=q4`);
        const tex = new THREE.Texture(image);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        const aspect = image.width / Math.max(1, image.height);
        let height = CARD_H[type];
        let width = height * aspect;
        if (width > CARD_MAX_W) {
          width = CARD_MAX_W;
          height = width / aspect;
        }
        art[side][type] = { tex, width, height };
      }
    }),
  );
  return art;
}

async function loadTexture(url) {
  const image = await loadImage(url);
  const tex = new THREE.Texture(image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function paintCover(g, image, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  g.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function boardTexture(wood) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = Math.round(1400 * (BOARD_D / BOARD_W));
  const g = canvas.getContext("2d");
  paintCover(g, wood, canvas.width, canvas.height);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = "#e4b56a";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = "source-over";
  const vignette = g.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.18,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.72,
  );
  vignette.addColorStop(0, "rgba(255, 226, 176, 0.1)");
  vignette.addColorStop(1, "rgba(92, 44, 16, 0.38)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const xOf = (file) => ((MARGIN + file * S) / BOARD_W) * w;
  const yOf = (rank) => ((MARGIN + rank * S) / BOARD_D) * h;

  const ink = "rgba(58, 32, 16, 0.88)";
  g.lineWidth = 4;
  g.lineCap = "square";
  g.strokeStyle = ink;
  g.beginPath();
  for (let rank = 0; rank < 10; rank++) {
    g.moveTo(xOf(0), yOf(rank));
    g.lineTo(xOf(8), yOf(rank));
  }
  for (let file = 0; file < 9; file++) {
    g.moveTo(xOf(file), yOf(0));
    g.lineTo(xOf(file), yOf(4));
    g.moveTo(xOf(file), yOf(5));
    g.lineTo(xOf(file), yOf(9));
  }
  g.moveTo(xOf(3), yOf(0));
  g.lineTo(xOf(5), yOf(2));
  g.moveTo(xOf(5), yOf(0));
  g.lineTo(xOf(3), yOf(2));
  g.moveTo(xOf(3), yOf(7));
  g.lineTo(xOf(5), yOf(9));
  g.moveTo(xOf(5), yOf(7));
  g.lineTo(xOf(3), yOf(9));
  g.stroke();

  const star = (file, rank, left, right) => {
    const cx = xOf(file);
    const cy = yOf(rank);
    const o = 7;
    const len = 16;
    g.beginPath();
    if (left) {
      g.moveTo(cx - o - len, cy - o);
      g.lineTo(cx - o, cy - o);
      g.lineTo(cx - o, cy - o - len);
      g.moveTo(cx - o - len, cy + o);
      g.lineTo(cx - o, cy + o);
      g.lineTo(cx - o, cy + o + len);
    }
    if (right) {
      g.moveTo(cx + o + len, cy - o);
      g.lineTo(cx + o, cy - o);
      g.lineTo(cx + o, cy - o - len);
      g.moveTo(cx + o + len, cy + o);
      g.lineTo(cx + o, cy + o);
      g.lineTo(cx + o, cy + o + len);
    }
    g.stroke();
  };
  star(1, 2, true, true);
  star(7, 2, true, true);
  star(1, 7, true, true);
  star(7, 7, true, true);
  for (const file of [2, 4, 6]) {
    star(file, 3, true, true);
    star(file, 6, true, true);
  }
  star(0, 3, false, true);
  star(0, 6, false, true);
  star(8, 3, true, false);
  star(8, 6, true, false);

  const bx = xOf(0) - 22;
  const by = yOf(0) - 22;
  const bw = xOf(8) - xOf(0) + 44;
  const bh = yOf(9) - yOf(0) + 44;
  g.lineWidth = 11;
  g.strokeStyle = ink;
  g.strokeRect(bx, by, bw, bh);
  g.lineWidth = 3;
  g.strokeRect(bx + 16, by + 16, bw - 32, bh - 32);

  g.fillStyle = "rgba(58, 32, 16, 0.82)";
  g.font = "700 72px KaiTi, DFKai-SB, PMingLiU, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const riverY = (yOf(4) + yOf(5)) / 2;
  g.fillText("楚河", (xOf(0) + xOf(3)) / 2, riverY);
  g.fillText("漢界", (xOf(5) + xOf(8)) / 2, riverY);

  g.font = "600 32px KaiTi, DFKai-SB, PMingLiU, serif";
  const redNum = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];
  for (let file = 0; file < 9; file++) {
    g.fillText(String(file + 1), xOf(file), yOf(0) - 36);
    g.fillText(redNum[file], xOf(file), yOf(9) + 36);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function banqiTexture(wood) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 560;
  const g = canvas.getContext("2d");
  paintCover(g, wood, canvas.width, canvas.height);
  const pad = 48;
  const cw = (canvas.width - pad * 2) / COLS;
  const ch = (canvas.height - pad * 2) / ROWS;
  g.strokeStyle = "rgba(58, 32, 16, 0.55)";
  g.lineWidth = 3;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      g.strokeRect(pad + x * cw + 8, pad + y * ch + 8, cw - 16, ch - 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function lidTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const grd = g.createRadialGradient(96, 80, 10, 128, 128, 120);
  grd.addColorStop(0, "#f3d2a4");
  grd.addColorStop(0.55, "#e09a55");
  grd.addColorStop(1, "#c4552a");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#7a2e12";
  g.font = "700 140px KaiTi, PMingLiU, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("橘", 128, 138);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(text, side) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const red = side === RED;
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = red ? "#f3d7a2" : "#d8d0c4";
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = red ? "#9d1c14" : "#14110e";
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = red ? "#f8e7b4" : "#f4efe4";
  g.font = "700 168px KaiTi, DFKai-SB, PMingLiU, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 146);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function mesh(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildKits() {
  const kits = {
    [RED]: {
      body: new THREE.MeshPhysicalMaterial({
        color: 0x9c241c,
        roughness: 0.32,
        metalness: 0.06,
        clearcoat: 0.55,
        clearcoatRoughness: 0.28,
      }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x6e1614, roughness: 0.72 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xd4b36a, metalness: 0.82, roughness: 0.28 }),
      tint: 0x9c241c,
      label: "#f4d7a4",
    },
    1: {
      body: new THREE.MeshPhysicalMaterial({
        color: 0x23201c,
        roughness: 0.38,
        metalness: 0.14,
        clearcoat: 0.4,
        clearcoatRoughness: 0.32,
      }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.8 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xaeb6bf, metalness: 0.78, roughness: 0.3 }),
      tint: 0x2a2724,
      label: "#efe6d6",
    },
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.68 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc6a15a, metalness: 0.84, roughness: 0.26 });
  return { kits, wood, brass };
}

function addNose(group) {
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2d48a, roughness: 0.4 }),
  );
  nose.name = "nose";
  nose.position.set(0, 0.72, -0.34);
  nose.castShadow = false;
  group.add(nose);
}

function pedestal(kit, wood, brass, neutral = false) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.1, 28), wood, 0, 0.05, 0));
  g.add(mesh(new THREE.TorusGeometry(0.345, 0.025, 8, 28), brass, 0, 0.1, 0, Math.PI / 2, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.045, 28), neutral ? wood : kit.body, 0, 0.125, 0));
  return g;
}

function figureOf(type, kit, wood) {
  const g = new THREE.Group();
  const { body, cloth, metal } = kit;
  if (type === 0) {
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.46, 18), cloth, 0, 0.4, 0));
    g.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), body, 0, 0.72, -0.02));
    g.add(mesh(new THREE.ConeGeometry(0.13, 0.2, 12), metal, 0, 0.9, 0));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), metal, 0.2, 0.72, -0.08));
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), metal, 0.2, 1.02, -0.08));
    g.add(mesh(new THREE.BoxGeometry(0.28, 0.34, 0.06), cloth, 0, 0.42, 0.12));
  } else if (type === 1) {
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.4, 16), cloth, 0, 0.36, 0));
    g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), body, 0, 0.64, 0));
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), metal, 0.16, 0.42, -0.02, 0, 0, 0.5));
  } else if (type === 2) {
    const torso = mesh(new THREE.SphereGeometry(0.22, 16, 12), cloth, 0, 0.36, 0.02);
    torso.scale.set(1.15, 0.78, 1.45);
    g.add(torso);
    g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), body, 0, 0.4, -0.32));
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), body, 0, 0.24, -0.48, 0.9, 0, 0));
    g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), cloth, -0.24, 0.46, -0.05));
    g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), cloth, 0.24, 0.46, -0.05));
    for (const sx of [-0.16, 0.16]) {
      for (const sz of [-0.16, 0.12]) {
        g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8), cloth, sx, 0.16, sz));
      }
    }
  } else if (type === 3) {
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 12), cloth, 0, 0.36, 0.05, Math.PI / 2, 0, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.24, 10), cloth, 0, 0.48, -0.24, 0.7, 0, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.18), body, 0, 0.58, -0.36));
    g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), body, 0, 0.62, -0.02));
    g.add(mesh(new THREE.ConeGeometry(0.08, 0.12, 8), metal, 0, 0.74, 0));
    for (const sx of [-0.1, 0.1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 6), cloth, sx, 0.18, 0.16));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 6), cloth, sx, 0.18, -0.08));
    }
  } else if (type === 4) {
    g.add(mesh(new THREE.BoxGeometry(0.46, 0.08, 0.62), wood, 0, 0.32, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), kit.metal, -0.28, 0.2, 0.05, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), kit.metal, 0.28, 0.2, 0.05, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.22, 0.28), cloth, 0, 0.5, 0.06));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 0.36), metal, 0, 0.66, 0.04));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.36), metal, 0, 0.24, -0.42));
  } else if (type === C) {
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.08, 0.5), wood, 0, 0.28, 0.06));
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 14), metal, -0.22, 0.18, 0, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 14), metal, 0.22, 0.18, 0, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.48, 14), metal, 0, 0.4, -0.08, Math.PI / 2, 0, 0));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), metal, 0, 0.22, 0.32));
  } else {
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.32, 14), cloth, 0, 0.32, 0));
    g.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), body, 0, 0.54, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), metal, -0.12, 0.34, -0.12));
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), metal, 0.12, 0.5, -0.06));
  }
  return g;
}

function makePiece(type, side, covered, libs, labels, art) {
  const kit = libs.kits[side];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  root.add(body);
  let cardH = 1;
  let badgeHost = body;
  let badgeY = 0.66;
  let badgeZ = 0.16;
  let badgeSize = 0.74;
  if (covered) {
    body.add(pedestal(kit, libs.wood, libs.brass, true));
    const dome = mesh(new THREE.SphereGeometry(0.46, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), libs.lidMat, 0, 0.18, 0);
    dome.name = "lid";
    body.add(dome);
    const disc = mesh(new THREE.CircleGeometry(0.36, 24), libs.lidFace, 0, 0.66, 0, -Math.PI / 2, 0, 0);
    disc.name = "lid";
    body.add(disc);
  } else if (art[side] && art[side][type]) {
    const card = art[side][type];
    cardH = card.height;
    const mat = new THREE.MeshBasicMaterial({
      map: card.tex,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    mat.userData.owned = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(card.width, card.height), mat);
    plane.name = "card";
    plane.position.y = card.height / 2;
    plane.castShadow = true;
    body.add(plane);
    badgeHost = plane;
    badgeY = 0;
    badgeZ = 0.16;
    badgeSize = Math.min(0.82, card.height * 0.42);
    const shadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    shadeMat.userData.owned = true;
    const shade = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.52, card.width * 0.48), 24), shadeMat);
    shade.name = "shade";
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = 0.02;
    root.add(shade);
  } else {
    body.add(pedestal(kit, libs.wood, libs.brass));
    body.add(figureOf(type, kit, libs.wood));
    addNose(body);
  }
  if (!covered) {
    const glyph = GLYPH[side === RED ? type + 1 : type + 1 + 7];
    const sprite = new THREE.Sprite(labels.get(glyph, side));
    sprite.position.set(0, badgeY, badgeZ);
    sprite.scale.set(badgeSize, badgeSize, 1);
    sprite.renderOrder = 4;
    sprite.name = "label";
    badgeHost.add(sprite);
  }
  root.userData.side = side;
  root.userData.type = type;
  root.userData.tint = covered ? 0xc47a3a : kit.tint;
  root.userData.cardH = cardH;
  root.rotation.y = side === RED ? 0 : Math.PI;
  return root;
}

export async function createStage(canvas, { onPick, onCue }) {
  const art = await loadArt();
  const wood = await loadImage(BOARD_FACE);
  const frameMap = await loadTexture(BOARD_FRAME);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(STAGE, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const look = new THREE.Vector3(0, 0, 0);
  let yaw = HOME_YAW;
  let pitch = HOME_PITCH;
  let dist = 18;
  let zoom = 1;
  let fitPad = PAD_HOME;
  let speedMul = 1;
  let labelsOn = false;
  let closeup = true;
  let quality = true;
  let mode = "xiangqi";

  scene.fog = new THREE.Fog(STAGE, 42, 96);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: STAGE, roughness: 1, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.4;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemi = new THREE.HemisphereLight(0xffe8cc, 0x2a1c22, 0.8);
  const key = new THREE.DirectionalLight(0xfff3dc, 1.45);
  key.position.set(1.5, 22, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight(0xc4b4a4, 0.28);
  fill.position.set(-7, 6, -5);
  const flash = new THREE.PointLight(0xffb060, 0, 5, 2);
  scene.add(hemi, key, fill, flash);

  const libs = buildKits();
  const lidTex = lidTexture();
  libs.lidMat = new THREE.MeshStandardMaterial({ color: 0xd08a45, roughness: 0.55, map: lidTex });
  libs.lidFace = new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.5 });
  const labelCache = new Map();
  const labels = {
    get(text, side) {
      const keyName = `${side}:${text}`;
      if (!labelCache.has(keyName)) labelCache.set(keyName, labelTexture(text, side));
      return new THREE.SpriteMaterial({
        map: labelCache.get(keyName),
        transparent: true,
        depthWrite: false,
      });
    },
  };

  const faceMat = new THREE.MeshStandardMaterial({
    map: boardTexture(wood),
    roughness: 0.92,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const xiangqiFace = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_D), faceMat);
  xiangqiFace.rotation.x = -Math.PI / 2;
  xiangqiFace.position.y = 0.028;
  xiangqiFace.receiveShadow = true;
  xiangqiFace.userData.surface = "xiangqi";

  const banqiW = (COLS - 1) * BANQI_S + 1.5;
  const banqiD = (ROWS - 1) * BANQI_S + 1.5;
  const banqiFace = new THREE.Mesh(
    new THREE.PlaneGeometry(banqiW, banqiD),
    new THREE.MeshStandardMaterial({ map: banqiTexture(wood), roughness: 0.72 }),
  );
  banqiFace.rotation.x = -Math.PI / 2;
  banqiFace.position.y = 0.028;
  banqiFace.receiveShadow = true;
  banqiFace.userData.surface = "banqi";
  banqiFace.visible = false;
  const frameMat = new THREE.MeshStandardMaterial({
    map: frameMap,
    color: 0xd8c4b0,
    roughness: 0.55,
    metalness: 0.05,
  });
  const slab = (w, d) => {
    const thick = 0.16;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), frameMat);
    mesh.position.y = -thick / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const xiangqiFrame = slab(BOARD_W + 0.5, BOARD_D + 0.5);
  const banqiFrame = slab(banqiW + 0.46, banqiD + 0.46);
  banqiFrame.visible = false;
  scene.add(xiangqiFace, banqiFace, xiangqiFrame, banqiFrame);

  const pieceRoot = new THREE.Group();
  const markerRoot = new THREE.Group();
  scene.add(pieceRoot, markerRoot);
  const pieces = new Map();

  const dotMat = new THREE.MeshBasicMaterial({ color: 0x1f6b38, transparent: true, opacity: 0.9 });
  const capMat = new THREE.MeshBasicMaterial({ color: 0xc4372a, transparent: true, opacity: 0.95 });
  const selMat = new THREE.MeshBasicMaterial({ color: 0xe0b14a, transparent: true, opacity: 0.95 });
  const lastMat = new THREE.MeshBasicMaterial({ color: 0xf0d7a0, transparent: true, opacity: 0.7 });

  const jobs = [];
  const particles = [];
  let camGen = 0;
  let lastTime = performance.now();

  function tween(duration, tick, cam = false) {
    const gen = cam ? camGen : 0;
    return new Promise((resolve) => {
      jobs.push({ t0: performance.now(), duration: Math.max(16, duration), tick, resolve, cam, gen });
    });
  }

  function pitchForFrame() {
    const aspect = (canvas.clientWidth || 1) / Math.max(1, canvas.clientHeight || 1);
    if (aspect < 0.85) return 1.02;
    if (aspect > 1.25) return HOME_PITCH;
    return 0.9;
  }

  function applyCamera() {
    const cp = Math.cos(pitch);
    camera.position.set(
      look.x + dist * Math.sin(yaw) * cp,
      look.y + dist * Math.sin(pitch),
      look.z + dist * Math.cos(yaw) * cp,
    );
    camera.lookAt(look);
  }

  function boardSpan() {
    if (mode === "banqi") return { hw: banqiW / 2, hd: banqiD / 2, top: 0.62 };
    return { hw: BOARD_W / 2, hd: BOARD_D / 2, top: 0.42 };
  }

  const fitPoint = new THREE.Vector3();
  const fitForward = new THREE.Vector3();

  function inside(testDist) {
    const prev = dist;
    dist = testDist;
    applyCamera();
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(fitForward);
    const { hw, hd, top } = boardSpan();
    let ok = true;
    for (const y of [0.02, top]) {
      for (const x of [-hw, hw]) {
        for (const z of [-hd, hd]) {
          fitPoint.set(x, y, z);
          if (fitPoint.clone().sub(camera.position).dot(fitForward) < 0.2) ok = false;
          const projected = fitPoint.clone().project(camera);
          const slack = fitPad / PAD_HOME;
          if (Math.abs(projected.x) > 0.99 * slack) ok = false;
          if (projected.y < -0.97 * slack || projected.y > 0.95 * slack) ok = false;
        }
      }
    }
    dist = prev;
    return ok;
  }

  function applyFit() {
    look.set(0, 0.08, 0);
    let lo = 4;
    let hi = 64;
    if (!inside(hi)) {
      dist = hi * zoom;
      applyCamera();
      return;
    }
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inside(mid)) hi = mid;
      else lo = mid;
    }
    dist = hi * zoom;
    applyCamera();
  }

  function cancelCamera() {
    camGen += 1;
  }

  function placeOf(index) {
    if (mode === "xiangqi") return squareToWorld(index % 9, (index / 9) | 0);
    return banqiToWorld(index % COLS, (index / COLS) | 0);
  }

  function ring(inner, outer, mat, pos) {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    m.position.y = 0.04;
    markerRoot.add(m);
  }

  function clearMarkers() {
    while (markerRoot.children.length) markerRoot.remove(markerRoot.children[0]);
  }

  function showGuides({ selected, targets, last, hint, occupied }) {
    clearMarkers();
    for (const to of targets || []) {
      const pos = placeOf(to);
      if (occupied(to)) ring(0.3, 0.4, capMat, pos);
      else ring(0.07, 0.14, dotMat, pos);
    }
    if (selected != null) ring(0.32, 0.4, selMat, placeOf(selected));
    if (last && last.from != null) {
      ring(0.28, 0.34, lastMat, placeOf(last.from));
      ring(0.28, 0.34, lastMat, placeOf(last.to));
    } else if (last && last.index != null) {
      ring(0.28, 0.34, lastMat, placeOf(last.index));
    }
    if (hint && hint.to != null) ring(0.26, 0.36, selMat, placeOf(hint.to));
    if (hint && hint.index != null && hint.kind === "flip") ring(0.26, 0.36, selMat, placeOf(hint.index));
  }

  function setLabelVisible(group) {
    const label = group.getObjectByName("label");
    if (label) label.visible = labelsOn;
  }

  function dropGroup(group) {
    pieceRoot.remove(group);
    group.traverse((obj) => {
      if (obj.isSprite && obj.material) obj.material.dispose();
    if (obj.isMesh && obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of list) if (mat.userData.owned) mat.dispose();
    }
    });
  }

  function clearPieces() {
    for (const group of pieces.values()) dropGroup(group);
    pieces.clear();
  }

  function layout(state) {
    mode = state.mode;
    const xiangqiOn = mode === "xiangqi";
    xiangqiFace.visible = xiangqiOn;
    banqiFace.visible = !xiangqiOn;
    xiangqiFrame.visible = xiangqiOn;
    banqiFrame.visible = !xiangqiOn;
    clearPieces();
    clearMarkers();
    if (xiangqiOn) {
      for (let i = 0; i < 90; i++) {
        const p = state.board[i];
        if (!p) continue;
        const group = makePiece(pieceType(p), pieceSide(p), false, libs, labels, art);
        group.position.copy(squareToWorld(i % 9, (i / 9) | 0));
        group.userData.index = i;
        setLabelVisible(group);
        pieceRoot.add(group);
        pieces.set(i, group);
      }
    } else {
      for (let i = 0; i < 32; i++) {
        const p = state.banqi.pieces[i];
        if (!p) continue;
        const covered = state.banqi.face[i] === 1;
        const group = makePiece(pieceType(p), pieceSide(p), covered, libs, labels, art);
        group.position.copy(banqiToWorld(i % COLS, (i / COLS) | 0));
        group.userData.index = i;
        setLabelVisible(group);
        pieceRoot.add(group);
        pieces.set(i, group);
      }
    }
  }

  const puffCanvas = document.createElement("canvas");
  puffCanvas.width = 128;
  puffCanvas.height = 128;
  {
    const g = puffCanvas.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, "rgba(214, 184, 130, 0.65)");
    grd.addColorStop(1, "rgba(214, 184, 130, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const puffTex = new THREE.CanvasTexture(puffCanvas);

  function puff(pos, scale) {
    const mat = new THREE.SpriteMaterial({
      map: puffTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    });
    mat.userData.sharedMap = true;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.position.y += 0.12;
    sprite.scale.setScalar(scale);
    scene.add(sprite);
    particles.push({
      m: sprite,
      v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.25 + Math.random() * 0.45, (Math.random() - 0.5) * 0.6),
      life: 0.7,
      dust: true,
      base: scale,
    });
  }

  function strike(pos, type, cannon) {
    const heavy = cannon || type === K || type === E || type === R;
    const power = cannon ? 1.7 : heavy ? 1.3 : 0.85;
    flash.position.set(pos.x, 0.7, pos.z);
    flash.color.set(cannon ? 0xffb15a : 0xffe2b0);
    flash.intensity = 12 * power;
    tween(320, (e) => {
      flash.intensity = 12 * power * (1 - e);
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf0d2a4,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.26, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.03, pos.z);
    scene.add(ring);
    tween(460, (e) => {
      ring.scale.setScalar(1 + e * (2.2 + power));
      ringMat.opacity = 0.7 * (1 - e);
    }).then(() => {
      scene.remove(ring);
      ring.geometry.dispose();
      ringMat.dispose();
    });
    const shards = Math.round((cannon ? 24 : 14) * (closeup ? 1 : 0.65));
    for (let i = 0; i < shards; i++) {
      const size = 0.035 + Math.random() * 0.06;
      const mat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xd8b072 : 0x8a4030,
        roughness: 0.5,
      });
      const chip = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.45, size * 1.4), mat);
      chip.position.set(pos.x, 0.28, pos.z);
      scene.add(chip);
      particles.push({
        m: chip,
        v: new THREE.Vector3((Math.random() - 0.5) * 3.4 * power, 1.4 + Math.random() * 2.6, (Math.random() - 0.5) * 3.4 * power),
        life: 0.75,
      });
    }
    const sparks = cannon ? 16 : type === A || type === P ? 12 : 7;
    for (let i = 0; i < sparks; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe6b0 });
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), mat);
      spark.position.set(pos.x, 0.4, pos.z);
      scene.add(spark);
      particles.push({
        m: spark,
        v: new THREE.Vector3((Math.random() - 0.5) * 4.2, 1.2 + Math.random() * 3, (Math.random() - 0.5) * 4.2),
        life: 0.28,
        spark: true,
      });
    }
    for (let i = 0; i < (heavy ? 9 : 5); i++) puff(pos, 0.35 + Math.random() * 0.4);
  }

  async function relocate({ from, to, capture, cannon, type }) {
    const meshPiece = pieces.get(from);
    const victim = capture ? pieces.get(to) : null;
    if (!meshPiece) return;
    const kind = type ?? meshPiece.userData.type;
    const dest = placeOf(to);
    const start = meshPiece.position.clone();
    const body = meshPiece.getObjectByName("body");
    const shade = meshPiece.getObjectByName("shade");
    const dur = ((capture ? 1080 : 820) * (kind === R ? 0.78 : kind === H ? 0.92 : 1)) / speedMul;
    const travel = dest.clone().sub(start);
    travel.y = 0;
    if (travel.lengthSq() > 0.0001) travel.normalize();
    let shot = null;
    if (cannon && capture) {
      shot = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xffd7a2, emissive: 0xff6a1a, emissiveIntensity: 1.4, roughness: 0.35 }),
      );
      shot.position.copy(start);
      shot.position.y = 0.55;
      scene.add(shot);
    }
    onCue?.({ kind: "move", type: kind, capture, cannon, voice: !capture || !!cannon });
    let hitSent = false;
    let landed = false;
    let dustMark = 0;
    const padHome = PAD_HOME;
    await tween(dur, (_e, u) => {
      const pose = travelPose(kind, u, capture);
      const along = ease(u);
      meshPiece.position.lerpVectors(start, dest, along);
      meshPiece.position.addScaledVector(travel, -pose.back);
      meshPiece.position.y = SURFACE + pose.hop - pose.squat * 0.05;
      if (body) {
        body.rotation.x = pose.rx;
        body.rotation.z = pose.rz;
        const squat = pose.squat;
        body.scale.set(1 + squat * 0.2, Math.max(0.58, 1 - squat * 0.36), 1 + squat * 0.2);
      }
      if (!landed && u >= 0.78) {
        landed = true;
        thud(capture ? 1.2 : kind === R || kind === E || kind === K ? 0.7 : 0.4);
        puff(dest, capture ? 0.95 : 0.55);
      }
      if (shade) {
        shade.position.y = 0.02 - pose.hop;
        shade.scale.setScalar(Math.max(0.45, 1 - pose.hop));
      }
      if ((kind === H || kind === E || kind === R || kind === P) && u - dustMark > (kind === R ? 0.1 : 0.22)) {
        dustMark = u;
        puff(meshPiece.position, kind === E ? 0.5 : 0.28);
      }
      if (shot) {
        const su = Math.min(1, u / 0.66);
        shot.position.lerpVectors(start, dest, su);
        shot.position.y = 0.5 + Math.sin(su * Math.PI) * 0.7;
        if (u - dustMark > 0.08) {
          dustMark = u;
          puff(shot.position, 0.22);
        }
      }
      if (victim && u > 0.72) {
        const k = (u - 0.72) / 0.28;
        victim.rotation.z = k * (kind === R ? 0.35 : 0.85);
        const squash = kind === R || kind === E ? 0.65 : 0.25;
        victim.scale.set(1 + k * 0.08, Math.max(0.25, 1 - k * squash), 1);
      }
      if (capture && closeup) {
        let k = 0;
        if (u < 0.2) k = u / 0.2;
        else if (u > 0.78) k = Math.max(0, 1 - (u - 0.78) / 0.22);
        else k = 1;
        fitPad = padHome + 0.07 * k;
        applyFit();
      }
      if (capture && !hitSent && u > (cannon ? 0.64 : 0.8)) {
        hitSent = true;
        onCue?.({ kind: "hit", type: kind, cannon, voice: true });
        strike(dest, kind, cannon);
      }
    });
    if (body) {
      body.rotation.x = 0;
      body.rotation.z = 0;
      body.scale.set(1, 1, 1);
    }
    meshPiece.position.copy(dest);
    meshPiece.scale.set(1, 1, 1);
    if (shade) {
      shade.position.y = 0.02;
      shade.scale.setScalar(1);
    }
    fitPad = padHome;
    applyFit();
    if (shot) {
      scene.remove(shot);
      shot.geometry.dispose();
      shot.material.dispose();
    }
    if (victim) {
      dropGroup(victim);
      pieces.delete(to);
    }
    pieces.delete(from);
    meshPiece.userData.index = to;
    pieces.set(to, meshPiece);
  }

  async function flip(index) {
    const group = pieces.get(index);
    if (!group) return;
    onCue?.({ kind: "flip" });
    const body = group.getObjectByName("body");
    await tween(460 / speedMul, (_e, u) => {
      if (body) {
        body.rotation.x = u * Math.PI;
        body.position.y = Math.sin(u * Math.PI) * 0.38;
      }
    });
  }

  function faceSide(side, instant) {
    const goalYaw = side === RED ? HOME_YAW : Math.PI - HOME_YAW;
    const goalPitch = pitchForFrame();
    look.set(0, 0, 0);
    if (instant) {
      cancelCamera();
      yaw = goalYaw;
      pitch = goalPitch;
      zoom = 1;
      fitPad = PAD_HOME;
      applyFit();
      return;
    }
    const fromYaw = yaw;
    const fromPitch = pitch;
    const delta = angDelta(fromYaw, goalYaw);
    const gen = ++camGen;
    tween(700, (e) => {
      if (gen !== camGen) return;
      yaw = fromYaw + delta * e;
      pitch = fromPitch + (goalPitch - fromPitch) * e;
      look.set(0, 0, 0);
      applyFit();
    }, true);
  }

  function projectPoint(v) {
    v.project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
      behind: v.z > 1,
    };
  }

  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 700;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (!down) pitch = pitchForFrame();
    applyFit();
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function clientToIndex(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hitPiece = raycaster.intersectObjects(pieceRoot.children, true)[0];
    if (hitPiece) {
      let node = hitPiece.object;
      while (node && node.userData.index == null) node = node.parent;
      if (node) return node.userData.index;
    }
    const surface = mode === "xiangqi" ? xiangqiFace : banqiFace;
    const hitBoard = raycaster.intersectObject(surface, false)[0];
    if (!hitBoard) return null;
    if (mode === "xiangqi") {
      const sq = worldToSquare(hitBoard.point);
      if (sq.file < 0 || sq.file > 8 || sq.rank < 0 || sq.rank > 9) return null;
      const snapped = squareToWorld(sq.file, sq.rank);
      if (snapped.distanceTo(new THREE.Vector3(hitBoard.point.x, 0, hitBoard.point.z)) > 0.46) return null;
      return sq.rank * 9 + sq.file;
    }
    const cell = worldToBanqi(hitBoard.point);
    if (cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS) return null;
    return cell.y * COLS + cell.x;
  }

  let down = null;
  canvas.addEventListener("pointerdown", (event) => {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* 程式合成的點擊沒有真實指標，略過捕捉 */
    }
    down = { x: event.clientX, y: event.clientY, yaw, pitch, moved: false };
    cancelCamera();
    fitPad = PAD_HOME;
    onCue?.({ kind: "unlock" });
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!down) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    if (dx * dx + dy * dy > 16) down.moved = true;
    if (!down.moved) return;
    yaw = down.yaw - dx * 0.005;
    pitch = Math.min(1.2, Math.max(0.52, down.pitch - dy * 0.004));
    applyFit();
  });
  function endPointer(event) {
    if (!down) return;
    const moved = down.moved;
    down = null;
    canvas.classList.remove("dragging");
    if (!moved) {
      const index = clientToIndex(event.clientX, event.clientY);
      if (index != null) onPick(index);
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", () => {
    down = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom = Math.min(1.35, Math.max(0.78, zoom * (event.deltaY > 0 ? 1.06 : 0.94)));
      applyFit();
    },
    { passive: false },
  );

  let shake = 0;
  const shakeOffset = new THREE.Vector3();
  function thud(power) {
    shake = Math.max(shake, power);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    camera.position.sub(shakeOffset);
    shakeOffset.set(0, 0, 0);
    for (let i = jobs.length - 1; i >= 0; i--) {
      const job = jobs[i];
      if (job.cam && job.gen !== camGen) {
        jobs.splice(i, 1);
        job.resolve();
        continue;
      }
      const u = Math.min(1, (now - job.t0) / job.duration);
      job.tick(ease(u), u);
      if (u >= 1) {
        jobs.splice(i, 1);
        job.resolve();
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.v.y -= (p.dust ? 1.2 : p.spark ? 2.2 : 9) * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.m.rotation) p.m.rotation.x += dt * 6;
      if (p.dust && p.m.material) {
        p.m.material.opacity = Math.max(0, p.life);
        p.m.scale.setScalar(p.base * (1.6 - p.life));
      }
      if (p.life <= 0 || (!p.dust && p.m.position.y < 0)) {
        scene.remove(p.m);
        if (p.m.geometry) p.m.geometry.dispose();
        if (p.m.material) {
          if (p.m.material.userData.sharedMap) p.m.material.map = null;
          p.m.material.dispose();
        }
        particles.splice(i, 1);
      }
    }
    pieceRoot.updateWorldMatrix(true, true);
    for (const group of pieces.values()) {
      const card = group.getObjectByName("card");
      if (!card) continue;
      const world = card.getWorldPosition(fitPoint);
      const dx = camera.position.x - world.x;
      const dz = camera.position.z - world.z;
      const worldYaw = Math.atan2(dx, dz);
      const parent = card.parent;
      const el = parent.matrixWorld.elements;
      card.rotation.order = "YXZ";
      card.rotation.y = worldYaw - Math.atan2(el[8], el[10]);
    }
    if (shake > 0.004) {
      shakeOffset.set(
        (Math.random() - 0.5) * shake * 0.2,
        (Math.random() - 0.5) * shake * 0.08,
        (Math.random() - 0.5) * shake * 0.14,
      );
      camera.position.add(shakeOffset);
      shake *= 0.82;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);

  return {
    layout,
    showGuides,
    relocate,
    flip,
    faceSide,
    resize,
    setLabels(on) {
      labelsOn = on;
      for (const group of pieces.values()) setLabelVisible(group);
    },
    setCloseup(on) {
      closeup = on;
    },
    setSpeed(mult) {
      speedMul = mult;
    },
    setQuality(high) {
      quality = high;
      renderer.shadowMap.enabled = high;
      renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 2) : 1);
      key.castShadow = high;
      resize();
    },
    resetView() {
      faceSide(yaw > Math.PI / 2 && yaw < (Math.PI * 3) / 2 ? 1 : RED, false);
    },
    projectIndex(index) {
      const group = pieces.get(index);
      if (!group) return null;
      const v = group.getWorldPosition(new THREE.Vector3());
      v.y += 0.45;
      return projectPoint(v);
    },
    projectSquare(file, rank) {
      const v = squareToWorld(file, rank);
      v.y = 0.05;
      return projectPoint(v);
    },
    boardInside() {
      const { hw, hd, top } = boardSpan();
      const points = [];
      for (const y of [0.02, top]) {
        for (const x of [-hw, hw]) {
          for (const z of [-hd, hd]) points.push(projectPoint(new THREE.Vector3(x, y, z)));
        }
      }
      const rect = canvas.getBoundingClientRect();
      return points.every((p) => !p.behind && p.x >= rect.left - 1 && p.x <= rect.right + 1 && p.y >= rect.top - 1 && p.y <= rect.bottom + 1);
    },
    debugFrame() {
      const rows = [];
      for (const [index, group] of pieces) {
        const nose = group.getObjectByName("nose");
        if (!nose) continue;
        const origin = group.getWorldPosition(new THREE.Vector3());
        const tip = nose.getWorldPosition(new THREE.Vector3());
        rows.push({
          index,
          side: group.userData.side,
          dz: +(tip.z - origin.z).toFixed(3),
        });
      }
      const blackLeft = squareToWorld(0, 0);
      const redRight = squareToWorld(8, 9);
      return {
        rows,
        blackLeft: [+blackLeft.x.toFixed(2), +blackLeft.z.toFixed(2)],
        redRight: [+redRight.x.toFixed(2), +redRight.z.toFixed(2)],
        cameraZ: +camera.position.z.toFixed(2),
        pieceCount: pieces.size,
      };
    },
  };
}
