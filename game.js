'use strict';
// ============================================================
// Pixel Adventure — Kenney Pixel Platformer 에셋 기반 플랫포머
// 조작: ←→/A D 이동, Space/↑/W 점프, Enter 시작, R 재시작
// ============================================================

const TS = 18;            // 타일 크기(px)
const VIEW_W = 480, VIEW_H = 270;

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------- 에셋 로드 ----------
const IMG = {};
function loadImage(name, src) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[name] = im; res(); };
    im.src = src;
  });
}

const SND = {};
function loadSound(name) {
  const a = new Audio('assets/sounds/' + name + '.mp3');
  a.preload = 'auto';
  SND[name] = a;
}
['jump','coin','gem','stomp','hurt','win','start','boxhit'].forEach(loadSound);
function play(name, vol = 0.5) {
  const a = SND[name].cloneNode();
  a.volume = vol;
  a.play().catch(() => {});
}

// ---------- 스프라이트 인덱스 (tilemap_packed.png, 20열) ----------
const T = {
  // 지형 세트: [단독, 왼쪽 캡, 중앙, 오른쪽 캡]
  TOP_GRASS: [20, 21, 22, 23],
  TOP_SAND: [60, 61, 62, 63],
  TOP_SNOW: [80, 81, 82, 83],
  DIRT: [4, 5, 24, 25],       // 테두리 없는 순수 흙 (샘플 이미지 기준)
  PLAT: 146,
  CRATE: 26,
  QBOX: 10, QBOX_USED: 29,
  COIN: 151,
  GEM: 67,
  HEART_FULL: 44, HEART_EMPTY: 46,
  SIGN_R: 85,
  DOOR_BOT: 150, DOOR_TOP: 130,
  TREE: 126, CACTUS: 127, MUSHROOM: 128,
  CLOUD: [153, 154, 155],
  DIGIT0: 160,
  POWERUP_SHIELD: 156,      // 방어막 파워업
  POWERUP_DOUBLE: 157,      // 더블 점프 파워업 (추가용)
  SPIKES: 68,               // 가시 (밟으면 피해)
  BOUNCE: [15, 12, 13, 14], // 빨간 버섯 발판 [단독, 왼, 중, 오] — 밟으면 슈퍼 점프
  WATER_TOP: 33, WATER: 53, // 구덩이 물 (장식)
  // 장식 타일
  FENCE: 147, BENCH: 146, SNOWMAN: 145, SNOWPILE: 148,
  SPROUT: 124, SPROUT2: 125, FLOWER: 144, TRUNK: 137, FENCE_GATE: 106,
};
// 장식 그리드 기호 → 타일 매핑 (전부 비충돌)
const DECO_TILES = {
  s: T.SIGN_R, t: T.TREE, c: T.CACTUS, m: T.MUSHROOM,
  f: T.FENCE, n: T.SNOWMAN, r: T.SNOWPILE,
  g: T.SPROUT, h: T.SPROUT2, l: T.FLOWER, k: T.TRUNK, u: T.FENCE_GATE,
};
// 캐릭터 (tilemap-characters_packed.png, 24px, 9열)
const CH = {
  PLAYER: [0, 1],
  SLIME: [18, 19],
  FLY: [24, 25],
  SAW: 8,
  WALKER: [9, 10],   // 빠른 지상 순찰자
  BEE: [13, 14],     // 빠른 비행 적
};

function drawTile(idx, x, y) {
  const sx = (idx % 20) * TS, sy = Math.floor(idx / 20) * TS;
  ctx.drawImage(IMG.tiles, sx, sy, TS, TS, Math.round(x), Math.round(y), TS, TS);
}
function drawChar(idx, x, y, flip) {
  const sx = (idx % 9) * 24, sy = Math.floor(idx / 9) * 24;
  x = Math.round(x); y = Math.round(y);
  if (flip) {
    ctx.save();
    ctx.translate(x + 24, y);
    ctx.scale(-1, 1);
    ctx.drawImage(IMG.chars, sx, sy, 24, 24, 0, 0, 24, 24);
    ctx.restore();
  } else {
    ctx.drawImage(IMG.chars, sx, sy, 24, 24, x, y, 24, 24);
  }
}
// 적: 물리 박스 하단 중앙에 24px 스프라이트 정렬
function drawEnemy(e, idx, flip, yOff = 0) {
  drawChar(idx, e.x + e.w / 2 - 12, e.y + e.h - 24 + yOff, flip);
}

// ---------- 레벨 빌더 ----------
class LevelBuilder {
  constructor(w, h, theme) {
    this.w = w; this.h = h; this.theme = theme;
    this.grid = Array.from({ length: h }, () => new Array(w).fill(' '));
    this.entities = [];
    this.spawnX = 2 * TS; this.spawnY = 10 * TS;
  }
  set(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.grid[y][x] = c; }
  ground(x0, x1, top) { for (let x = x0; x <= x1; x++) for (let y = top; y < this.h; y++) this.set(x, y, '#'); }
  block(x, y) { this.set(x, y, '#'); }
  plat(x0, x1, y) { for (let x = x0; x <= x1; x++) this.set(x, y, '='); }
  crate(x, y) { this.set(x, y, 'X'); }
  qbox(x, y) { this.set(x, y, '!'); }
  coin(x, y) { this.set(x, y, 'o'); }
  coins(x0, x1, y) { for (let x = x0; x <= x1; x++) this.set(x, y, 'o'); }
  gem(x, y) { this.set(x, y, '*'); }
  deco(x, y, c) { this.set(x, y, c); }
  door(x, y) { this.set(x, y, 'd'); }
  spawn(x, y) { this.spawnX = x * TS; this.spawnY = y * TS; }
  powerup(x, y, type) { this.set(x, y, type === 'shield' ? 'S' : 'D'); }
  spike(x, y) { this.set(x, y, '^'); }
  bounce(x, y) { this.set(x, y, 'B'); }
  water(x, y) { this.set(x, y, 'w'); }
  enemy(type, x, y, opt) { this.entities.push(Object.assign({ type, tx: x, ty: y }, opt || {})); }
}

// 레벨 1: 초원
function buildLevel1() {
  const L = new LevelBuilder(140, 15, 'green');
  L.spawn(3, 9);
  L.ground(0, 16, 12);
  L.deco(5, 11, 's');           // 안내판
  L.deco(7, 11, 'g');           // 새싹
  L.deco(9, 11, 't');           // 나무
  L.deco(14, 11, 'l');          // 꽃
  L.coins(11, 13, 10);
  // 첫 구덩이 (17~18)
  L.ground(19, 32, 12);
  L.qbox(22, 8);
  L.coins(24, 26, 10);
  L.deco(29, 11, 'h');
  L.enemy('slime', 27, 11);
  L.crate(30, 11); L.crate(31, 11); L.crate(31, 10);
  // 발판 구간 (구덩이 33~36)
  L.plat(34, 35, 10);
  L.coin(34, 8); L.coin(35, 8);
  L.ground(37, 52, 11);
  L.deco(39, 10, 'm');
  L.deco(43, 10, 'g');
  L.coins(42, 46, 8);
  L.enemy('slime', 47, 10);
  L.deco(51, 10, 't');
  // 발판 (구덩이 53~56) → 아래 지대
  L.plat(54, 55, 9);
  L.ground(57, 72, 12);
  L.enemy('fly', 58, 7, { rangeX: 1 * TS });
  // 보석 계단 발판
  L.plat(60, 61, 10);
  L.plat(63, 64, 8);
  L.plat(66, 68, 6);
  L.gem(67, 4);
  L.enemy('saw', 66, 11);
  L.deco(71, 11, 'c');
  // 계단 언덕 (구덩이 73~74)
  L.ground(75, 95, 12);
  L.block(81, 11); L.block(82, 11);
  L.block(83, 11); L.block(83, 10); L.block(84, 11); L.block(84, 10);
  L.block(85, 11); L.block(85, 10); L.block(85, 9);
  L.block(86, 11); L.block(86, 10); L.block(86, 9);
  L.coin(81, 9); L.coin(83, 8); L.coin(85, 7);
  L.enemy('slime', 91, 11);
  // 발판 다리 (구덩이 96~99)
  L.plat(97, 98, 10);
  L.ground(100, 118, 12);
  L.qbox(104, 8); L.qbox(106, 8);
  L.coin(105, 10);
  L.enemy('fly', 111, 7, { rangeX: 3 * TS });
  L.coins(109, 113, 10);
  // 마지막 구간 (구덩이 119~122)
  L.plat(120, 121, 10);
  L.ground(123, 139, 12);
  L.deco(126, 11, 't');
  L.coins(128, 131, 9);
  L.deco(131, 11, 'm');
  L.deco(133, 11, 'l');
  L.door(135, 11);
  return L;
}

// 레벨 2: 사막
function buildLevel2() {
  const L = new LevelBuilder(150, 15, 'desert');
  L.spawn(2, 9);
  L.ground(0, 12, 12);
  L.deco(4, 11, 's');
  L.deco(6, 11, 'u');
  L.deco(8, 11, 'c');
  // 크레이트 언덕 (구덩이 13~14)
  L.ground(15, 28, 12);
  L.crate(19, 11); L.crate(20, 11); L.crate(20, 10);
  L.coins(17, 21, 8);
  L.deco(22, 11, 'k');
  L.enemy('saw', 24, 11);
  // 발판 사다리 상승 (구덩이 29~38)
  L.plat(30, 31, 10);
  L.plat(33, 34, 8);
  L.plat(36, 37, 6);
  L.coin(30, 8); L.coin(33, 6); L.coin(36, 4);
  // 높은 지대
  L.ground(39, 55, 7);
  L.enemy('slime', 44, 6);
  L.qbox(48, 3);
  L.coins(46, 50, 5);
  L.enemy('slime', 52, 6);
  // 낙하 + 아래 지대 (구덩이 56~57)
  L.ground(58, 74, 12);
  L.coins(59, 61, 9);
  L.deco(63, 11, 'u');
  L.enemy('saw', 64, 11);
  L.deco(68, 11, 'c');
  L.deco(71, 11, 'k');
  L.enemy('fly', 70, 8, { rangeX: 3 * TS });
  // 징검다리 (구덩이 75~76, 80~81, 85~86, 90~91)
  L.ground(77, 79, 12);
  L.ground(82, 84, 12);
  L.ground(87, 89, 12);
  L.coin(78, 9); L.coin(83, 9); L.coin(88, 9);
  // 보석 도전
  L.ground(92, 110, 12);
  L.plat(95, 96, 10);
  L.plat(98, 99, 8);
  L.gem(98, 6);
  L.enemy('saw', 102, 11);
  L.enemy('slime', 106, 11);
  L.qbox(104, 8);
  // 상승 계단 (구덩이 111~112)
  L.ground(113, 128, 12);
  L.block(117, 11); L.block(118, 11);
  L.block(119, 11); L.block(119, 10);
  L.block(120, 11); L.block(120, 10); L.block(120, 9);
  L.coins(116, 120, 7);
  L.enemy('slime', 124, 11);
  // 골인 (구덩이 129~132)
  L.plat(130, 131, 10);
  L.ground(133, 149, 12);
  L.deco(135, 11, 'u');
  L.deco(137, 11, 'c');
  L.coins(139, 142, 9);
  L.enemy('slime', 141, 11);
  L.door(145, 11);
  return L;
}

// 레벨 3: 산 (고급 도전)
function buildLevel3() {
  const L = new LevelBuilder(160, 15, 'mountain');
  L.spawn(2, 10);
  L.ground(0, 15, 12);
  L.deco(5, 11, 's');
  L.deco(7, 11, 'n');
  L.deco(10, 11, 't');
  L.deco(13, 11, 'f');
  L.coins(12, 14, 10);

  // 높은 절벽 도전 (구덩이 16~20)
  L.plat(21, 22, 8);
  L.plat(24, 25, 6);
  L.plat(27, 28, 4);
  L.coin(21, 6); L.coin(24, 4); L.coin(27, 2);
  L.gem(27, 1);
  L.powerup(25, 7, 'double');       // 더블 점프 파워업
  L.enemy('fly', 23, 3, { rangeX: 2 * TS });

  // 넓은 평지 + 톱니 회피
  L.ground(30, 50, 12);
  L.deco(32, 11, 'r');
  L.enemy('saw', 35, 11);
  L.coins(38, 42, 8);
  L.deco(43, 11, 'f');
  L.enemy('slime', 45, 11);
  L.qbox(48, 9);
  L.deco(49, 11, 'k');

  // 좁은 발판 구간 (구덩이 51~57)
  L.ground(58, 65, 12);
  L.plat(60, 61, 10);
  L.plat(63, 64, 8);
  L.coin(60, 8); L.coin(63, 6);
  L.enemy('fly', 62, 6, { rangeX: 3 * TS });

  // 계단 상승
  L.block(67, 11); L.block(68, 11);
  L.block(69, 11); L.block(69, 10);
  L.block(70, 11); L.block(70, 10); L.block(70, 9);
  L.block(71, 11); L.block(71, 10); L.block(71, 9); L.block(71, 8);
  L.coins(67, 71, 6);

  // 높은 지대 + 어려운 적들
  L.ground(73, 95, 6);
  L.enemy('saw', 80, 5);
  L.enemy('slime', 88, 5);
  L.qbox(85, 2);
  L.coins(76, 80, 4);
  L.coins(90, 93, 4);
  L.gem(88, 2);
  L.powerup(82, 4, 'shield');       // 방어막 파워업

  // 하강 발판
  L.plat(97, 98, 9);
  L.plat(100, 101, 8);
  L.plat(103, 104, 7);
  L.coin(97, 7); L.coin(100, 6); L.coin(103, 5);
  L.enemy('fly', 101, 6, { rangeX: 2 * TS });

  // 낙하 존 + 최종 구간
  L.ground(106, 125, 12);
  L.deco(108, 11, 'r');
  L.deco(110, 11, 'k');
  L.coins(115, 120, 8);
  L.enemy('saw', 112, 11);
  L.deco(118, 11, 'n');
  L.enemy('slime', 122, 11);

  // 최종 도전 (구덩이 126~129)
  L.plat(130, 131, 10);
  L.ground(133, 159, 12);
  L.deco(136, 11, 'n');
  L.deco(138, 11, 't');
  L.deco(141, 11, 'f');
  L.coins(145, 150, 9);
  L.gem(148, 7);
  L.deco(152, 11, 'r');
  L.enemy('slime', 155, 11);
  L.door(155, 11);

  return L;
}

// ---------- 절차 생성 레벨 (스테이지 4~50) ----------
// 시드 고정 난수: 같은 스테이지는 항상 같은 지형
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ri(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

const DECOS = {
  green:    ['t', 'g', 'm', 'h', 'l', 't'],
  desert:   ['c', 'u', 'k', 's', 'c', 'u'],
  mountain: ['n', 'f', 'r', 't', 'k', 'r'],
};

// 지상 적 풀: 난이도에 따라 슬라임 → 워커/톱니 비율 상승
function groundEnemyType(rng, d) {
  const r = rng();
  if (r < 0.18 + d * 0.32) return 'saw';
  if (r < 0.75 - d * 0.15) return 'slime';
  return 'walker';
}
// 비행 적 풀
function airEnemyType(rng, d) {
  return rng() < 0.3 + d * 0.4 ? 'bee' : 'fly';
}

// 평지: 코인/적/가시/상자/장식 배치. 항상 지면으로 끝남
function segFlat(L, x, rng, d) {
  const len = ri(rng, 9, 14);
  L.ground(x, x + len - 1, 12);
  if (rng() < 0.8) {
    const c0 = x + ri(rng, 1, 2);
    L.coins(c0, Math.min(x + len - 2, c0 + ri(rng, 2, 4)), ri(rng, 8, 10));
  }
  const enemyN = rng() < 0.35 + d * 0.55 ? (rng() < d * 0.6 ? 2 : 1) : 0;
  for (let i = 0; i < enemyN; i++) {
    L.enemy(groundEnemyType(rng, d), x + 3 + Math.floor(rng() * (len - 5)), 11);
  }
  // 가시: 순찰 적이 없는 평지에만, 위에 코인으로 점프 유도
  if (enemyN === 0 && rng() < 0.25 + d * 0.4) {
    const sx = x + ri(rng, 3, len - 4);
    L.spike(sx, 11);
    if (rng() < 0.3 + d * 0.4) L.spike(sx + 1, 11);
    L.coin(sx, 8);
  }
  if (rng() < 0.3) L.qbox(x + ri(rng, 2, len - 3), 8);
  if (rng() < 0.25) {
    const cx = x + ri(rng, 2, len - 3);
    L.crate(cx, 11);
    if (rng() < 0.5) L.crate(cx, 10);
  }
  const decos = DECOS[L.theme];
  if (rng() < 0.55) L.deco(x + ri(rng, 1, len - 2), 11, decos[ri(rng, 0, decos.length - 1)]);
  if (rng() < 0.35) L.deco(x + ri(rng, 1, len - 2), 11, decos[ri(rng, 0, decos.length - 1)]);
  if (rng() < 0.1 + d * 0.08) L.powerup(x + ri(rng, 2, len - 3), 9, rng() < 0.5 ? 'shield' : 'double');
  return x + len;
}

// 구덩이: 바닥에 물(장식), 넓으면 중간 발판 제공. 다음 세그먼트는 반드시 지면
function segPit(L, x, rng, d) {
  const gap = ri(rng, 2, 3 + Math.round(d * 2));   // 2~5
  if (gap >= 4) {
    const px = x + Math.floor(gap / 2) - 1;
    L.plat(px, px + 1, 10);
    L.coin(px, 8);
    if (rng() < d * 0.5) L.enemy(airEnemyType(rng, d), px, 6, { rangeX: 2 * TS });
  } else if (rng() < 0.5) {
    L.coin(x + Math.floor(gap / 2), 9);
  }
  for (let wx = x; wx < x + gap; wx++) { L.water(wx, 13); L.water(wx, 14); }
  return x + gap;
}

// 징검다리 섬들 (사이사이 물)
function segStones(L, x, rng, d) {
  const n = ri(rng, 2, 3);
  for (let i = 0; i < n; i++) {
    const gap = ri(rng, 2, 3);
    for (let wx = x; wx < x + gap; wx++) { L.water(wx, 13); L.water(wx, 14); }
    x += gap;
    const w = ri(rng, 2, 3);
    L.ground(x, x + w - 1, 12);
    if (rng() < 0.6) L.coin(x + Math.floor(w / 2), 9);
    if (rng() < d * 0.35 && w >= 3) L.enemy('slime', x + 1, 11);
    x += w;
  }
  return x;
}

// 구덩이 위 발판 사다리 (보석 도전). 다음 세그먼트는 반드시 지면
function segLadder(L, x, rng, d, state) {
  L.plat(x + 1, x + 2, 10);
  L.plat(x + 4, x + 5, 8);
  L.plat(x + 7, x + 8, 6);
  L.coin(x + 1, 8); L.coin(x + 4, 6);
  if (!state.gem && rng() < 0.7) { L.gem(x + 7, 4); state.gem = true; }
  else L.coin(x + 7, 4);
  L.plat(x + 10, x + 11, 9);
  if (rng() < 0.3 + d * 0.5) L.enemy(airEnemyType(rng, d), x + 5, 5, { rangeX: 2 * TS });
  for (let wx = x; wx < x + 13; wx++) { L.water(wx, 13); L.water(wx, 14); }
  return x + 13;
}

// 구덩이 + 버섯 발판: 빠지면 슈퍼 점프로 탈출, 높은 곳에 보상. 다음은 반드시 지면
function segBounce(L, x, rng, d, state) {
  const gap = ri(rng, 4, 6);
  const bx = x + Math.floor(gap / 2) - 1;
  L.bounce(bx, 13); L.bounce(bx + 1, 13);
  L.coin(bx, 10); L.coin(bx + 1, 10);
  L.coin(bx, 7); L.coin(bx + 1, 7);
  if (!state.gem && rng() < 0.45) { L.gem(bx, 4); state.gem = true; }
  else if (rng() < 0.4) { L.coin(bx, 4); L.coin(bx + 1, 4); }
  return x + gap;
}

// 계단 언덕
function segHill(L, x, rng, d) {
  const len = ri(rng, 10, 14);
  L.ground(x, x + len - 1, 12);
  const sx = x + 2;
  L.block(sx, 11);
  L.block(sx + 1, 11); L.block(sx + 1, 10);
  L.block(sx + 2, 11); L.block(sx + 2, 10); L.block(sx + 2, 9);
  L.coins(sx, sx + 2, 7);
  if (rng() < 0.4 + d * 0.5) L.enemy(groundEnemyType(rng, d), x + len - 3, 11);
  if (rng() < 0.4) L.deco(x + len - 2, 11, DECOS[L.theme][ri(rng, 0, DECOS[L.theme].length - 1)]);
  return x + len;
}

// 높은 지대: 발판으로 상승 → 고지대 → 오른쪽 끝에서 낙하. 다음은 반드시 지면
function segPlateau(L, x, rng, d, state) {
  L.plat(x + 1, x + 2, 10);
  L.plat(x + 4, x + 5, 8);
  const len = ri(rng, 9, 13);
  L.ground(x + 7, x + 7 + len - 1, 7);
  L.coins(x + 8, x + 8 + Math.min(3, len - 3), 5);
  const enemyN = rng() < 0.5 + d * 0.5 ? (rng() < d * 0.5 ? 2 : 1) : 0;
  for (let i = 0; i < enemyN; i++) {
    L.enemy(groundEnemyType(rng, d), x + 9 + Math.floor(rng() * (len - 4)), 6);
  }
  if (rng() < 0.35) L.qbox(x + 8 + ri(rng, 1, len - 3), 3);
  if (!state.gem && rng() < 0.35) { L.gem(x + 7 + Math.floor(len / 2), 2); state.gem = true; }
  return x + 7 + len;
}

function buildGeneratedLevel(stage) {
  const rng = mulberry32(stage * 1013904223 + 5);
  const d = Math.min(1, (stage - 3) / 40);          // 난이도 0(4스테이지)→1(43+)
  const themes = ['green', 'desert', 'mountain'];
  const theme = themes[(stage - 1) % 3];
  const width = Math.min(150 + stage * 2, 250);
  const L = new LevelBuilder(width, 15, theme);
  const state = { gem: false };

  // 시작 안전 지대
  L.spawn(3, 9);
  L.ground(0, 11, 12);
  L.deco(4, 11, 's');
  L.coins(7, 9, 10);

  let x = 12;
  let needGround = false;   // 구덩이류 다음엔 반드시 지면
  while (x < width - 26) {
    if (needGround) {
      x = segFlat(L, x, rng, d);
      needGround = false;
      continue;
    }
    const r = rng();
    if (r < 0.20) { x = segPit(L, x, rng, d); needGround = true; }
    else if (r < 0.34) { x = segStones(L, x, rng, d); }
    else if (r < 0.47) { x = segLadder(L, x, rng, d, state); needGround = true; }
    else if (r < 0.60) { x = segPlateau(L, x, rng, d, state); needGround = true; }
    else if (r < 0.72) { x = segHill(L, x, rng, d); }
    else if (r < 0.82) { x = segBounce(L, x, rng, d, state); needGround = true; }
    else { x = segFlat(L, x, rng, d); }
  }

  // 골인 구간
  L.ground(x, width - 1, 12);
  if (!state.gem) L.gem(x + 2, 9);
  L.coins(width - 12, width - 9, 9);
  if (d > 0.3) L.enemy('slime', width - 10, 11);
  L.deco(width - 7, 11, DECOS[theme][0]);
  L.door(width - 4, 11);
  return L;
}

const STAGE_COUNT = 50;
const LEVELS = [buildLevel1, buildLevel2, buildLevel3];
for (let s = 4; s <= STAGE_COUNT; s++) {
  LEVELS.push(buildGeneratedLevel.bind(null, s));
}

// ---------- 게임 상태 ----------
const game = {
  state: 'title',       // title | play | clear | gameover | win
  levelIdx: 0,
  coins: 0,
  gems: 0,
  hearts: 3,
  time: 0,
  stateTime: 0,
  levelTime: 0,         // 각 레벨 클리어 시간
  totalScore: 0,        // 총 스코어
};

let level = null;
let player = null;
let enemies = [];
let particles = [];
let popups = [];        // 상자에서 튀어나오는 코인 연출

function isSolid(c) { return c === '#' || c === 'X' || c === '!' || c === 'x' || c === 'B'; }
function cellAt(tx, ty) {
  if (ty < 0 || tx < 0 || tx >= level.w || ty >= level.h) return ' ';
  return level.grid[ty][tx];
}

// 적 물리 박스 크기 (스프라이트는 박스 하단에 정렬해 그림)
const ENEMY_BOX = {
  slime:  { w: 18, h: 14 },
  fly:    { w: 18, h: 12 },
  saw:    { w: 18, h: 18 },
  walker: { w: 16, h: 18 },
  bee:    { w: 16, h: 12 },
};

function loadLevel(idx) {
  level = LEVELS[idx]();
  player = {
    x: level.spawnX, y: level.spawnY,
    w: 14, h: 20,
    vx: 0, vy: 0,
    onGround: false, flip: false,
    coyote: 0, jumpBuf: 0,
    iframes: 0, anim: 0,
    doubleJumpsLeft: 1,              // 더블 점프 활성화
    shieldHealth: 0,                 // 방어막 (1 = 활성, 0 = 비활성)
    shieldTimer: 0,
    noCut: 0,                        // 버섯 발판 직후 가변 점프 컷 방지 타이머
  };
  enemies = level.entities.map(e => {
    const box = ENEMY_BOX[e.type];
    const base = {
      type: e.type,
      w: box.w, h: box.h,
      x: e.tx * TS, y: (e.ty + 1) * TS - box.h,   // 타일 바닥에 발 맞춤
      vy: 0, dead: 0, anim: Math.random() * 2,
    };
    if (e.type === 'slime')  return { ...base, vx: -25 };
    if (e.type === 'saw')    return { ...base, vx: -35 };
    if (e.type === 'walker') return { ...base, vx: -45 };
    // fly / bee
    const airSpd = e.type === 'bee' ? 45 : 30;
    return { ...base, vx: airSpd, anchorX: base.x, anchorY: base.y, rangeX: e.rangeX || (e.type === 'bee' ? 3 : 2) * TS };
  });
  particles = [];
  popups = [];
}

function startGame() {
  game.levelIdx = 0; game.coins = 0; game.gems = 0; game.hearts = 3;
  game.time = 0; game.levelTime = 0; game.totalScore = 0;
  loadLevel(0);
  game.state = 'play';
  play('start');
}

// ---------- 입력 ----------
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (game.state === 'play') player.jumpBuf = 0.12;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.state === 'title' || game.state === 'gameover' || game.state === 'win') startGame();
      else if (game.state === 'clear') nextLevel();
    }
    if (e.code === 'KeyR' && game.state === 'play') {
      game.hearts = 3; loadLevel(game.levelIdx);
    }
  }
  keys[e.code] = true;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function nextLevel() {
  // 스코어 계산 (시간 보너스)
  const timeBonus = Math.max(0, 300 - game.levelTime * 100); // 3초 이내 보너스
  game.totalScore += Math.round(timeBonus);

  game.levelIdx++;
  game.levelTime = 0;
  game.hearts = 3;      // 스테이지 클리어 시 하트 회복 (50스테이지 완주용)
  if (game.levelIdx >= LEVELS.length) {
    game.state = 'win'; game.stateTime = 0;
    play('win', 0.7);
  } else {
    loadLevel(game.levelIdx);
    game.state = 'play';
    play('start');
  }
}

// ---------- 물리 ----------
const GRAV = 830, MOVE = 130, JUMP_V = 292, MAX_FALL = 320, BOUNCE_V = 460;

function moveAndCollide(ent, dt, oneWay) {
  // X축
  ent.x += ent.vx * dt;
  let x0 = Math.floor(ent.x / TS), x1 = Math.floor((ent.x + ent.w - 1) / TS);
  let y0 = Math.floor(ent.y / TS), y1 = Math.floor((ent.y + ent.h - 1) / TS);
  ent.hitWall = false;
  for (let ty = y0; ty <= y1; ty++) {
    if (ent.vx > 0 && isSolid(cellAt(x1, ty))) { ent.x = x1 * TS - ent.w; ent.hitWall = true; }
    else if (ent.vx < 0 && isSolid(cellAt(x0, ty))) { ent.x = (x0 + 1) * TS; ent.hitWall = true; }
  }
  // Y축
  const prevBottom = ent.y + ent.h;
  ent.y += ent.vy * dt;
  x0 = Math.floor(ent.x / TS); x1 = Math.floor((ent.x + ent.w - 1) / TS);
  y0 = Math.floor(ent.y / TS); y1 = Math.floor((ent.y + ent.h - 1) / TS);
  ent.onGround = false;
  for (let tx = x0; tx <= x1; tx++) {
    if (ent.vy >= 0) {
      const c = cellAt(tx, y1);
      if (isSolid(c) || (c === '=' && prevBottom <= y1 * TS + 2)) {
        ent.y = y1 * TS - ent.h; ent.vy = 0; ent.onGround = true;
        // 버섯 발판: 플레이어가 밟으면 슈퍼 점프
        if (c === 'B' && ent === player) {
          ent.vy = -BOUNCE_V; ent.onGround = false; ent.noCut = 0.35;
          play('jump', 0.55);
          spawnBurst(ent.x + ent.w / 2, ent.y + ent.h, '#e2554d');
        }
      }
    } else {
      const c = cellAt(tx, y0);
      if (isSolid(c)) {
        ent.y = (y0 + 1) * TS; ent.vy = 0;
        if (ent === player && c === '!') hitQBox(tx, y0);
      }
    }
  }
}

function hitQBox(tx, ty) {
  level.grid[ty][tx] = 'x';
  game.coins++;
  play('boxhit', 0.4);
  play('coin', 0.4);
  popups.push({ x: tx * TS, y: ty * TS - TS, t: 0 });
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hurtPlayer() {
  if (player.iframes > 0) return;

  // 방어막이 있으면 방어막 손상
  if (player.shieldHealth > 0) {
    player.shieldHealth--;
    player.iframes = 0.5;
    player.vx = player.flip ? 50 : -50;
    player.vy = -100;
    play('hurt', 0.3);
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, '#ff6b6b');
    return;
  }

  game.hearts--;
  player.iframes = 1.5;
  player.vy = -160;
  player.vx = player.flip ? 100 : -100;
  play('hurt', 0.5);
  if (game.hearts <= 0) {
    game.state = 'gameover'; game.stateTime = 0;
  }
}

function spawnBurst(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 60;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0, life: 0.5, color });
  }
}

// ---------- 업데이트 ----------
function update(dt) {
  game.stateTime += dt;
  if (game.state !== 'play') return;
  game.time += dt;
  game.levelTime += dt;

  // --- 플레이어 ---
  const p = player;
  const left = keys.ArrowLeft || keys.KeyA, right = keys.ArrowRight || keys.KeyD;
  let target = 0;
  if (left) { target = -MOVE; p.flip = true; }
  if (right) { target = MOVE; p.flip = false; }
  const accel = p.onGround ? 900 : 600;
  if (target > p.vx) p.vx = Math.min(target, p.vx + accel * dt);
  else if (target < p.vx) p.vx = Math.max(target, p.vx - accel * dt);
  else if (p.onGround) p.vx *= Math.pow(0.0001, dt);

  p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL);
  p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);

  // 접지 시 더블 점프 초기화
  if (p.onGround) p.doubleJumpsLeft = 1;

  if (p.jumpBuf > 0) {
    if (p.coyote > 0) {
      // 일반 점프 (접지)
      p.vy = -JUMP_V; p.jumpBuf = 0; p.coyote = 0;
      play('jump', 0.35);
    } else if (p.doubleJumpsLeft > 0) {
      // 더블 점프 (공중)
      p.vy = -JUMP_V; p.jumpBuf = 0; p.doubleJumpsLeft--;
      play('jump', 0.35);
      spawnBurst(p.x + p.w / 2, p.y + p.h, '#ffad28');
    }
  }

  // 가변 점프 (키를 떼면 낮게 뜀) — 버섯 발판 직후에는 컷 없음
  if (p.noCut <= 0 && p.vy < -120 && !(keys.Space || keys.ArrowUp || keys.KeyW)) p.vy = -120;

  moveAndCollide(p, dt, true);
  p.x = Math.max(0, Math.min(p.x, level.w * TS - p.w));
  p.iframes = Math.max(0, p.iframes - dt);
  p.noCut = Math.max(0, p.noCut - dt);
  p.anim += dt;

  // 낙사
  if (p.y > level.h * TS + 40) {
    game.hearts--;
    play('hurt', 0.5);
    if (game.hearts <= 0) { game.state = 'gameover'; game.stateTime = 0; return; }
    p.x = level.spawnX; p.y = level.spawnY; p.vx = 0; p.vy = 0; p.iframes = 1.5;
  }

  // --- 수집 ---
  const px0 = Math.floor(p.x / TS), px1 = Math.floor((p.x + p.w - 1) / TS);
  const py0 = Math.floor(p.y / TS), py1 = Math.floor((p.y + p.h - 1) / TS);
  for (let ty = py0; ty <= py1; ty++) for (let tx = px0; tx <= px1; tx++) {
    const c = cellAt(tx, ty);
    if (c === 'o') {
      level.grid[ty][tx] = ' '; game.coins++;
      play('coin', 0.4);
      spawnBurst(tx * TS + 9, ty * TS + 9, '#ffd93b');
    } else if (c === '*') {
      level.grid[ty][tx] = ' '; game.gems++;
      play('gem', 0.55);
      spawnBurst(tx * TS + 9, ty * TS + 9, '#4fc3f7');
    } else if (c === 'S') {
      level.grid[ty][tx] = ' '; p.shieldHealth = 2;
      play('coin', 0.5);
      spawnBurst(tx * TS + 9, ty * TS + 9, '#ff9500');
    } else if (c === 'D') {
      level.grid[ty][tx] = ' '; p.doubleJumpsLeft++;
      play('coin', 0.5);
      spawnBurst(tx * TS + 9, ty * TS + 9, '#ffad28');
    } else if (c === '^') {
      // 가시: 타일 하단부와 겹칠 때만 피해 (스치듯 지나가는 억울한 판정 방지)
      const sb = { x: tx * TS + 2, y: ty * TS + 8, w: 14, h: 10 };
      if (overlaps(p, sb)) hurtPlayer();
    } else if (c === 'd') {
      game.state = 'clear'; game.stateTime = 0;
      play('win', 0.6);
    }
  }

  // --- 적 ---
  for (const e of enemies) {
    if (e.dead > 0) { e.dead += dt; continue; }
    e.anim += dt;
    if (e.type === 'slime' || e.type === 'saw' || e.type === 'walker') {
      e.vy += GRAV * dt;
      const aheadX = e.vx < 0 ? e.x - 1 : e.x + e.w + 1;
      const footY = Math.floor((e.y + e.h + 2) / TS);
      const aheadC = cellAt(Math.floor(aheadX / TS), footY);
      const onEdge = !isSolid(aheadC) && aheadC !== '=';
      moveAndCollide(e, dt, false);
      if (e.hitWall || (e.onGround && onEdge)) e.vx = -e.vx;
    } else if (e.type === 'fly' || e.type === 'bee') {
      e.x += e.vx * dt;
      if (e.x > e.anchorX + e.rangeX) { e.x = e.anchorX + e.rangeX; e.vx = -Math.abs(e.vx); }
      if (e.x < e.anchorX - e.rangeX) { e.x = e.anchorX - e.rangeX; e.vx = Math.abs(e.vx); }
      const amp = e.type === 'bee' ? 10 : 6, freq = e.type === 'bee' ? 4.5 : 3;
      e.y = e.anchorY + Math.sin(e.anim * freq) * amp;
    }
    // 플레이어와 충돌
    if (overlaps(player, e)) {
      const stompable = e.type !== 'saw';
      if (stompable && player.vy > 40 && player.y + player.h - e.y < 12) {
        e.dead = 0.001;
        player.vy = -190;
        play('stomp', 0.5);
        spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#9bd4ff');
      } else {
        hurtPlayer();
      }
    }
  }
  enemies = enemies.filter(e => e.dead < 0.35);

  // --- 파티클/팝업 ---
  for (const pt of particles) {
    pt.t += dt; pt.vy += 400 * dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
  }
  particles = particles.filter(pt => pt.t < pt.life);
  for (const pp of popups) pp.t += dt;
  popups = popups.filter(pp => pp.t < 0.5);
}

// ---------- 렌더링 ----------
const THEMES = {
  green:  { skyTop: '#bdefff', skyBot: '#e3f8ff', bgCol: 6, topSet: T.TOP_GRASS },
  desert: { skyTop: '#ffe6b3', skyBot: '#fff4d6', bgCol: 4, topSet: T.TOP_SAND },
  mountain: { skyTop: '#8ba5d9', skyBot: '#c5d9f1', bgCol: 8, topSet: T.TOP_SNOW },
};

let camX = 0;

function wrap(v, m) { return ((v % m) + m) % m; }

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (game.state === 'title') { renderTitle(); return; }
  if (game.state === 'win') { renderWin(); return; }

  const theme = THEMES[level.theme];
  // 하늘
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, theme.skyTop); g.addColorStop(1, theme.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 카메라
  const targetX = player.x + player.w / 2 - VIEW_W / 2;
  camX += (targetX - camX) * 0.15;
  camX = Math.max(0, Math.min(camX, level.w * TS - VIEW_W));

  // 배경 지평선 (패럴랙스)
  const bgc = theme.bgCol;
  const horizonY = VIEW_H - 96;
  const par = wrap(camX * 0.3, 48);
  for (let x = -48; x < VIEW_W + 48; x += 48) {
    const wx = Math.round(x - par);
    ctx.drawImage(IMG.bg, bgc * 24, 24, 24, 24, wx, horizonY, 24, 24);
    ctx.drawImage(IMG.bg, (bgc + 1) * 24, 24, 24, 24, wx + 24, horizonY, 24, 24);
    for (let y = horizonY + 24; y < VIEW_H; y += 24) {
      ctx.drawImage(IMG.bg, bgc * 24, 48, 24, 24, wx, y, 24, 24);
      ctx.drawImage(IMG.bg, (bgc + 1) * 24, 48, 24, 24, wx + 24, y, 24, 24);
    }
  }
  // 구름 (느린 패럴랙스)
  for (let i = 0; i < 8; i++) {
    const cx = wrap(i * 137 + 40 - camX * 0.5, VIEW_W + 80) - 40;
    const cy = 18 + (i * 53) % 60;
    if (i % 2) {
      drawTile(T.CLOUD[2], cx, cy);
    } else {
      drawTile(T.CLOUD[0], cx, cy);
      drawTile(T.CLOUD[1], cx + 18, cy);
    }
  }

  ctx.save();
  ctx.translate(-Math.round(camX), 0);

  // 타일
  const tx0 = Math.max(0, Math.floor(camX / TS)), tx1 = Math.min(level.w - 1, Math.ceil((camX + VIEW_W) / TS));
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = level.grid[ty][tx];
      if (c === ' ') continue;
      const x = tx * TS, y = ty * TS;
      const v = tx * 7 + ty * 13;
      switch (c) {
        case '#': {
          const above = cellAt(tx, ty - 1) === '#';
          if (above) {
            drawTile(T.DIRT[v % 4], x, y);
          } else {
            const hasL = cellAt(tx - 1, ty) === '#', hasR = cellAt(tx + 1, ty) === '#';
            const set = theme.topSet;
            drawTile((!hasL && !hasR) ? set[0] : !hasL ? set[1] : !hasR ? set[3] : set[2], x, y);
          }
          break;
        }
        case '=': drawTile(T.PLAT, x, y); break;
        case 'X': drawTile(T.CRATE, x, y); break;
        case '!': drawTile(T.QBOX, x, y); break;
        case 'x': drawTile(T.QBOX_USED, x, y); break;
        case 'o': drawTile(T.COIN, x, y + Math.sin(game.time * 4 + tx) * 1.5); break;
        case '*': drawTile(T.GEM, x, y + Math.sin(game.time * 3 + tx) * 2); break;
        case 'S': {
          ctx.save();
          ctx.globalAlpha = 0.7 + Math.sin(game.time * 3) * 0.3;
          ctx.fillStyle = '#ff9500';
          ctx.beginPath();
          ctx.arc(x + 9, y + 9 + Math.sin(game.time * 3 + tx) * 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'D': {
          ctx.save();
          ctx.globalAlpha = 0.7 + Math.sin(game.time * 3) * 0.3;
          ctx.fillStyle = '#ffad28';
          ctx.beginPath();
          ctx.arc(x + 9, y + 9 + Math.sin(game.time * 3 + tx) * 2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case '^': drawTile(T.SPIKES, x, y); break;
        case 'B': {
          const hasL = cellAt(tx - 1, ty) === 'B', hasR = cellAt(tx + 1, ty) === 'B';
          const set = T.BOUNCE;
          drawTile((!hasL && !hasR) ? set[0] : !hasL ? set[1] : !hasR ? set[3] : set[2], x, y);
          break;
        }
        case 'w': drawTile(cellAt(tx, ty - 1) === 'w' ? T.WATER : T.WATER_TOP, x, y); break;
        case 'd':
          drawTile(T.DOOR_TOP, x, y - TS);
          drawTile(T.DOOR_BOT, x, y);
          break;
        default:
          if (DECO_TILES[c] !== undefined) drawTile(DECO_TILES[c], x, y);
      }
    }
  }

  // 상자 코인 팝업
  for (const pp of popups) {
    const dy = -20 * Math.sin(Math.min(pp.t / 0.4, 1) * Math.PI);
    drawTile(T.COIN, pp.x, pp.y + dy);
  }

  // 적
  for (const e of enemies) {
    const f = Math.floor(e.anim * 6) % 2;
    if (e.dead > 0) {
      ctx.save();
      ctx.globalAlpha = 1 - e.dead / 0.35;
      const deadIdx = { slime: CH.SLIME[1], fly: CH.FLY[1], walker: CH.WALKER[1], bee: CH.BEE[1] };
      drawEnemy(e, deadIdx[e.type] ?? CH.SLIME[1], e.vx > 0, e.dead * 30);
      ctx.restore();
      continue;
    }
    if (e.type === 'slime') drawEnemy(e, CH.SLIME[f], e.vx > 0);
    else if (e.type === 'walker') drawEnemy(e, CH.WALKER[f], e.vx > 0);
    else if (e.type === 'bee') drawEnemy(e, CH.BEE[f], e.vx > 0);
    else if (e.type === 'fly') drawEnemy(e, CH.FLY[f], e.vx > 0);
    else if (e.type === 'saw') {
      ctx.save();
      ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h - 12));
      ctx.rotate(e.anim * 8 * (e.vx > 0 ? 1 : -1));
      ctx.drawImage(IMG.chars, 8 * 24, 0, 24, 24, -12, -12, 24, 24);
      ctx.restore();
    }
  }

  // 플레이어 (피격 시 깜빡임)
  if (Math.floor(player.iframes * 12) % 2 === 0) {
    const moving = Math.abs(player.vx) > 15;
    let frame = CH.PLAYER[0];
    if (!player.onGround) frame = CH.PLAYER[1];
    else if (moving) frame = CH.PLAYER[Math.floor(player.anim * 8) % 2];
    drawChar(frame, player.x - 5, player.y - 4, player.flip);

    // 방어막 렌더
    if (player.shieldHealth > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(game.time * 4) * 0.2;
      ctx.strokeStyle = player.shieldHealth > 1 ? '#ffb300' : '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.round(player.x + player.w / 2), Math.round(player.y + player.h / 2), 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 파티클
  for (const pt of particles) {
    ctx.globalAlpha = 1 - pt.t / pt.life;
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  renderHUD();

  if (game.state === 'clear') renderOverlay('LEVEL CLEAR!', 'Enter 키로 다음 레벨');
  if (game.state === 'gameover') renderOverlay('GAME OVER', 'Enter 키로 다시 시작');
}

function drawNumber(n, x, y) {
  const str = String(n);
  for (let i = 0; i < str.length; i++) {
    drawTile(T.DIGIT0 + Number(str[i]), x + i * 12, y);
  }
}

function renderHUD() {
  for (let i = 0; i < 3; i++) {
    drawTile(i < game.hearts ? T.HEART_FULL : T.HEART_EMPTY, 8 + i * 20, 8);
  }
  drawTile(T.COIN, 8, 28);
  drawNumber(game.coins, 30, 28);
  if (game.gems > 0) {
    drawTile(T.GEM, 8, 48);
    drawNumber(game.gems, 30, 48);
  }

  // 더블 점프 표시
  if (player.doubleJumpsLeft > 0) {
    ctx.fillStyle = '#ffad28';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('DJ:' + player.doubleJumpsLeft, 8, 68);
  }

  // 방어막 표시
  if (player.shieldHealth > 0) {
    ctx.fillStyle = player.shieldHealth > 1 ? '#ffb300' : '#ff6b6b';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText('SH:' + player.shieldHealth, 8, 80);
  }

  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = '#26314e';
  ctx.textAlign = 'right';
  ctx.fillText('LEVEL ' + (game.levelIdx + 1) + '/' + LEVELS.length, VIEW_W - 8, 18);
  ctx.textAlign = 'left';
}

function renderOverlay(title, sub) {
  ctx.fillStyle = 'rgba(20, 24, 46, 0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#ffd93b';
  if (game.stateTime % 1 < 0.6) ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 18);
  ctx.textAlign = 'left';
}

function renderTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#bdefff'); g.addColorStop(1, '#e3f8ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 6; i++) {
    const cx = wrap(i * 90 + game.stateTime * 8, VIEW_W + 40) - 20;
    const cy = 20 + (i * 37) % 56;
    if (i % 2) {
      drawTile(T.CLOUD[2], cx, cy);
    } else {
      drawTile(T.CLOUD[0], cx, cy);
      drawTile(T.CLOUD[1], cx + 18, cy);
    }
  }
  for (let x = 0; x < VIEW_W; x += TS) {
    drawTile(T.TOP_GRASS[2], x, VIEW_H - 36);
    drawTile(T.DIRT[2], x, VIEW_H - 18);
  }
  drawTile(T.TREE, 60, VIEW_H - 54);
  drawTile(T.SPROUT, 90, VIEW_H - 54);
  drawTile(T.MUSHROOM, 380, VIEW_H - 54);
  drawTile(T.FLOWER, 405, VIEW_H - 54);
  drawTile(T.SNOWMAN, 440, VIEW_H - 54);
  drawTile(T.SIGN_R, 300, VIEW_H - 54);
  drawTile(T.COIN, 200, VIEW_H - 80 + Math.sin(game.stateTime * 3) * 3);
  drawTile(T.GEM, 240, VIEW_H - 90 + Math.sin(game.stateTime * 3 + 1) * 3);
  const f = Math.floor(game.stateTime * 4) % 2;
  drawChar(CH.PLAYER[f], 120, VIEW_H - 60);
  drawChar(CH.SLIME[f], 330, VIEW_H - 60, true);
  drawChar(CH.WALKER[f], 265, VIEW_H - 60, true);
  drawChar(CH.BEE[f], 160, VIEW_H - 92 + Math.sin(game.stateTime * 4) * 4);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#26314e';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText('PIXEL ADVENTURE', VIEW_W / 2, 70);
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = '#4a5578';
  ctx.fillText('이동: ← →  /  점프: Space  /  더블점프: 공중에서 Space  /  재시작: R', VIEW_W / 2, 105);
  ctx.fillText('적을 밟아 무찌르고 문까지 도달하세요! (톱니는 밟기 금지)', VIEW_W / 2, 118);
  ctx.fillText('S: 방어막  D: 더블점프  빨간 버섯: 슈퍼 점프  가시: 밟으면 아야!', VIEW_W / 2, 131);
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillStyle = '#e2554d';
  if (game.stateTime % 1 < 0.6) ctx.fillText('- Enter 키를 눌러 시작 -', VIEW_W / 2, 165);
  ctx.textAlign = 'left';
}

function renderWin() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#2a2f55'); g.addColorStop(1, '#4a5578');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd93b';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillText('YOU WIN!', VIEW_W / 2, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText('모든 레벨을 클리어했습니다!', VIEW_W / 2, 85);

  // 통계
  drawTile(T.COIN, VIEW_W / 2 - 50, 100);
  drawNumber(game.coins, VIEW_W / 2 - 26, 100);
  drawTile(T.GEM, VIEW_W / 2 + 10, 100);
  drawNumber(game.gems, VIEW_W / 2 + 34, 100);

  ctx.fillStyle = '#ffad28';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText('SCORE: ' + game.totalScore, VIEW_W / 2, 135);

  const f = Math.floor(game.stateTime * 4) % 2;
  drawChar(CH.PLAYER[f], VIEW_W / 2 - 12, 155 + Math.sin(game.stateTime * 5) * 4);

  ctx.fillStyle = '#9bd4ff';
  ctx.font = 'bold 12px "Courier New", monospace';
  if (game.stateTime % 1 < 0.6) ctx.fillText('- Enter 키로 다시 플레이 -', VIEW_W / 2, 220);
  ctx.textAlign = 'left';
}

// ---------- 메인 루프 ----------
let lastT = 0, acc = 0;
const STEP = 1 / 60;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(loop);
}

Promise.all([
  loadImage('tiles', 'assets/tiles.png'),
  loadImage('chars', 'assets/chars.png'),
  loadImage('bg', 'assets/bg.png'),
]).then(() => {
  // 개발용: #dev<레벨>x<타일X> 로 바로 해당 위치에서 시작 (예: #dev1x60)
  const m = location.hash.match(/^#dev(\d+)(?:x(\d+))?$/);
  if (m) {
    startGame();
    const li = Math.min(Number(m[1]) - 1, LEVELS.length - 1);
    if (li > 0) { game.levelIdx = li; loadLevel(li); }
    if (m[2]) { player.x = Number(m[2]) * TS; camX = player.x - VIEW_W / 2; }
  }
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(loop); });
});
