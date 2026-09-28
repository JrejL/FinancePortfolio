// 3D model of the Car Perfume bottle, built entirely in code (no model files):
// a cube glass body (smooth clear glass or faceted "pebble" glass), a square cap
// with a vented top and the embossed "Car Perfume" logo, and the braided hanging cord.
// 1 unit is roughly 1 cm.
//
// The glass is lit the way product photographers light glass on white: soft strip
// lights for highlights, plus dark panels that only show up *through* the glass,
// so edges and inner walls read as thick clear glass instead of white plastic.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const BODY = {
  clear: { w: 3.05, h: 2.85, r: 0.3 },
  textured: { w: 3.45, h: 2.75, r: 0.34 },
};

const CAP = { w: 2.7, h: 1.72, r: 0.1, lidW: 2.34, lidH: 0.42, lidR: 0.07, gap: 0.16 };

const FINISH = {
  black: { base: "#141416", hole: "#b3875a", metal: 0, rough: 0.14, coat: 1, env: 1.4 },
  gold: { base: "#ebc163", hole: "#241b12", metal: 1, rough: 0.14, coat: 0, env: 2.1 },
  silver: { base: "#eceef2", hole: "#1b1c1f", metal: 1, rough: 0.08, coat: 0, env: 2.5 },
};

// ---------------------------------------------------------------------------
// Procedural textures (drawn once, shared by every bottle)

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable jittered Voronoi. Per pixel: distance to the nearest point, a border
// measure (0 on a cell border, growing inward), the nearest cell's index and the
// offset from that cell's point.
function voronoi(size, cells, seed, jitter = 0.8) {
  const rand = rng(seed);
  const pts = [];
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const j = (1 - jitter) / 2;
      pts.push([(gx + j + rand() * jitter) / cells, (gy + j + rand() * jitter) / cells]);
    }
  }
  const n = size * size;
  const edge = new Float32Array(n);
  const near = new Float32Array(n);
  const cell = new Int32Array(n);
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const cx = Math.floor(u * cells);
      const cy = Math.floor(v * cells);
      let d1 = 9;
      let d2 = 9;
      let best = 0;
      let bx = 0;
      let by = 0;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          let gx = cx + ox;
          let gy = cy + oy;
          const wx = Math.floor(gx / cells);
          const wy = Math.floor(gy / cells);
          gx -= wx * cells;
          gy -= wy * cells;
          const p = pts[gy * cells + gx];
          const ddx = u - (p[0] + wx);
          const ddy = v - (p[1] + wy);
          const d = Math.hypot(ddx, ddy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = gy * cells + gx;
            bx = ddx;
            by = ddy;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const i = y * size + x;
      edge[i] = (d2 - d1) * cells;
      near[i] = d1 * cells;
      cell[i] = best;
      dx[i] = bx * cells;
      dy[i] = by * cells;
    }
  }
  return { edge, near, cell, dx, dy, count: cells * cells };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function dataTexture(c, { srgb = false, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Height field -> tangent-space normal map canvas.
function normalCanvas(height, size, strength, wrap = true) {
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const at = (x, y) => {
    if (wrap) return height[((y + size) % size) * size + ((x + size) % size)];
    return height[Math.min(size - 1, Math.max(0, y)) * size + Math.min(size - 1, Math.max(0, x))];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const gy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(gx, gy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-gx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (gy / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Pebble glass: each cell is a flat, slightly tilted facet with a crisp bevel into
// the groove around it, like pressed/cut glass. Tilts make neighbouring facets catch
// light differently. Grooves are thicker glass, so they read darker and richer.
function makePebbleMaps() {
  const size = 1024;
  const vor = voronoi(size, 3, 11, 0.75);
  const rand = rng(77);
  const tilts = Array.from({ length: vor.count }, () => [(rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9]);
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) {
    const bevel = smooth(0.0, 0.085, vor.edge[i]);
    const [tx, ty] = tilts[vor.cell[i]];
    const facet = 1 + (tx * vor.dx[i] + ty * vor.dy[i]) * 0.5 - 0.12 * vor.near[i] * vor.near[i];
    height[i] = bevel * facet;
  }
  const normal = dataTexture(normalCanvas(height, size, 11), { repeat: true });

  const tc = canvas(size, size);
  const tctx = tc.getContext("2d");
  const timg = tctx.createImageData(size, size);
  for (let i = 0; i < height.length; i++) {
    const v = (0.4 + 0.6 * (1 - smooth(0, 0.12, vor.edge[i]))) * 255;
    timg.data[i * 4] = timg.data[i * 4 + 1] = timg.data[i * 4 + 2] = v;
    timg.data[i * 4 + 3] = 255;
  }
  tctx.putImageData(timg, 0, 0);
  const thickness = dataTexture(tc, { repeat: true });
  return { normal, thickness };
}

// Mask for the vented cap: organic cut-outs separated by a web of material.
let perfMask = null;
function getPerfMask() {
  if (perfMask) return perfMask;
  const size = 512;
  const { edge, near } = voronoi(size, 4, 29, 0.85);
  const mask = new Float32Array(size * size);
  const depth = new Float32Array(size * size);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = smooth(0.12, 0.17, edge[i]) * smooth(0.64, 0.52, near[i]); // 1 = hole
    depth[i] = smooth(0.14, 0.34, edge[i]); // deeper toward the middle of a hole
  }
  perfMask = { size, mask, depth };
  return perfMask;
}

const perfCache = {};
function getPerfTextures(finishName) {
  if (perfCache[finishName]) return perfCache[finishName];
  const f = FINISH[finishName];
  const { size, mask, depth } = getPerfMask();
  const base = new THREE.Color(f.base);
  const hole = new THREE.Color(f.hole);
  const col = canvas(size, size);
  const bump = canvas(size, size);
  const cctx = col.getContext("2d");
  const bctx = bump.getContext("2d");
  const cimg = cctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const noise = rng(5);
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i];
    // The felt wick seen through the holes: shaded at the rim, a little fibrous.
    const shade = (0.45 + 0.55 * depth[i]) * (0.92 + noise() * 0.12);
    const j = i * 4;
    cimg.data[j] = (base.r + (hole.r * shade - base.r) * m) * 255;
    cimg.data[j + 1] = (base.g + (hole.g * shade - base.g) * m) * 255;
    cimg.data[j + 2] = (base.b + (hole.b * shade - base.b) * m) * 255;
    cimg.data[j + 3] = 255;
    const b = (1 - m * (0.6 + 0.4 * depth[i])) * 255;
    bimg.data[j] = bimg.data[j + 1] = bimg.data[j + 2] = b;
    bimg.data[j + 3] = 255;
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  const map = dataTexture(col, { srgb: true });
  const bumpMap = dataTexture(bump);
  // The cap's side faces are wider than tall; crop the pattern so holes stay round.
  const sideMap = map.clone();
  const sideBump = bumpMap.clone();
  for (const t of [sideMap, sideBump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, CAP.h / CAP.w);
    t.needsUpdate = true;
  }
  perfCache[finishName] = { map, bumpMap, sideMap, sideBump };
  return perfCache[finishName];
}

// Raised script logo for the front and back of the cap.
let logoBump = null;
function getLogoBump() {
  if (logoBump) return logoBump;
  const w = 1024;
  const h = Math.round((w * CAP.h) / CAP.w);
  const c = canvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(h * 0.22)}px Pacifico, "Brush Script MT", cursive`;
  // Two passes: a soft shoulder and a crisp top, so the letters have a rounded bevel.
  ctx.filter = "blur(5px)";
  ctx.fillStyle = "#777";
  ctx.fillText("Car Perfume", w / 2, h * 0.52, w * 0.74);
  ctx.filter = "blur(1.5px)";
  ctx.fillStyle = "#fff";
  ctx.fillText("Car Perfume", w / 2, h * 0.52, w * 0.74);
  logoBump = dataTexture(c);
  return logoBump;
}

// Braided cord: diagonal twisted strands along the tube.
let braid = null;
function getBraid() {
  if (braid) return braid;
  const size = 128;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = Math.sin(((x + y) / size) * Math.PI * 8);
      const b = Math.sin(((x - y) / size) * Math.PI * 8);
      height[y * size + x] = Math.max(a, b) * 0.5 + 0.5;
    }
  }
  braid = dataTexture(normalCanvas(height, size, 2.2), { repeat: true });
  braid.repeat.set(90, 1);
  return braid;
}

// Inner walls of the thick glass: white with darkened edges. Only ever seen through
// the glass (see refractionOnly), where it draws the cavity and heavy base.
let wallTex = null;
function getWallTexture() {
  if (wallTex) return wallTex;
  const size = 256;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const e = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
      const v = 250 - 150 * (1 - smooth(0.0, 0.07, e));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  wallTex = dataTexture(c, { srgb: true });
  return wallTex;
}

// Outline of the inside walls: a thin dark line along each edge of each face, clear
// in between, so the hollow shows through as empty glass.
let outlineTex = null;
function getOutlineTexture() {
  if (outlineTex) return outlineTex;
  const size = 256;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const e = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
      const i = (y * size + x) * 4;
      const v = Math.round(120 + 110 * smooth(0.0, 0.04, e));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = e < 0.04 ? 255 : 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  outlineTex = dataTexture(c, { srgb: true });
  return outlineTex;
}

let pebble = null;
const getPebble = () => (pebble ||= makePebbleMaps());

// An opaque object that is drawn only into the transmission buffer (what the glass
// sees behind itself) and never directly on screen.
function refractionOnly(mesh) {
  mesh.onBeforeRender = (renderer, scene, camera, geometry, material) => {
    const hidden = renderer.getRenderTarget() === null;
    material.colorWrite = !hidden;
    material.depthWrite = !hidden;
  };
  return mesh;
}

// ---------------------------------------------------------------------------
// Materials

function glassMaterial(bottle, textured, withTexture) {
  const tint = new THREE.Color(bottle.glass);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff").lerp(tint, textured ? 0.1 : 0),
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: textured ? 2.2 : 1.5,
    ior: 1.52,
    dispersion: textured ? 2 : 1,
    attenuationColor: tint,
    attenuationDistance: textured ? 2.4 : 6,
    specularIntensity: 1,
    envMapIntensity: 1.35,
  });
  if (withTexture) {
    const p = getPebble();
    m.normalMap = p.normal;
    m.normalScale = new THREE.Vector2(1, 1);
    m.thicknessMap = p.thickness;
  }
  return m;
}

// The hollow inside the glass: tapered, sitting on a thick base.
function cavity(b, textured, inside = "outline") {
  const top = b.h - 0.12;
  const bottom = textured ? 0.5 : 0.62;
  const geo = new RoundedBoxGeometry(b.w * 0.84, top - bottom, b.w * 0.84, 4, 0.2);
  const pos = geo.attributes.position;
  const hh = (top - bottom) / 2;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + hh) / (2 * hh);
    const k = 0.76 + 0.24 * t;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const material =
    inside === "solid"
      ? new THREE.MeshBasicMaterial({ map: getWallTexture(), toneMapped: false })
      : new THREE.MeshBasicMaterial({ map: getOutlineTexture(), alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
  const mesh = refractionOnly(new THREE.Mesh(geo, material));
  mesh.position.y = bottom + hh;
  return mesh;
}

function capMaterials(finishName) {
  const f = FINISH[finishName];
  const common = {
    metalness: f.metal,
    roughness: f.rough,
    clearcoat: f.coat,
    clearcoatRoughness: 0.06,
    envMapIntensity: f.env,
  };
  const perf = getPerfTextures(finishName);
  const plain = new THREE.MeshPhysicalMaterial({ ...common, color: f.base });
  const logo = new THREE.MeshPhysicalMaterial({ ...common, color: f.base, bumpMap: getLogoBump(), bumpScale: 6 });
  const top = new THREE.MeshPhysicalMaterial({
    ...common,
    color: "#ffffff",
    map: perf.map,
    bumpMap: perf.bumpMap,
    bumpScale: 7,
  });
  const side = new THREE.MeshPhysicalMaterial({
    ...common,
    color: "#ffffff",
    map: perf.sideMap,
    bumpMap: perf.sideBump,
    bumpScale: 7,
  });
  return { plain, logo, top, side };
}

const cordMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: "#121215",
    roughness: 0.55,
    sheen: 0.8,
    sheenColor: new THREE.Color("#5a5a60"),
    sheenRoughness: 0.45,
    normalMap: getBraid(),
    normalScale: new THREE.Vector2(0.9, 0.9),
  });

// ---------------------------------------------------------------------------
// Geometry

function strand(points, radius = 0.075) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 120, radius, 12, false);
}

/**
 * Build one bottle.
 * @param {object} bottle  An entry from BOTTLES in scents.js ({ glass, textured, cap }).
 * @param {object} opts    cord: length of cord above the cap (0 for no cord).
 * @returns THREE.Group whose origin is the top of the cord (the pivot it swings from).
 *   root.userData.hang is the bottle itself (rotate it on Y to twist).
 */
export function buildBottle(bottle, { cord = 8, inside = "outline" } = {}) {
  const textured = !!bottle.textured;
  const b = textured ? BODY.textured : BODY.clear;
  const root = new THREE.Group();
  const hang = new THREE.Group();
  root.add(hang);

  // Glass body. Face order on a box: +x, -x, +y, -y, +z, -z.
  const bodyGeo = new RoundedBoxGeometry(b.w, b.h, b.w, 8, b.r);
  const glassSides = glassMaterial(bottle, textured, textured);
  const glassPlain = textured ? glassMaterial(bottle, textured, false) : glassSides;
  const body = new THREE.Mesh(bodyGeo, [glassSides, glassSides, glassPlain, glassPlain, glassSides, glassSides]);
  body.position.y = b.h / 2;
  hang.add(body);
  // The inside of the glass: by default only its outline, so the bottle reads as empty
  // glass ("solid" walls read as liquid filling it; the refill animation uses them).
  hang.add(cavity(b, textured, inside));

  // Short glass neck under the cap.
  const neck = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.4, 2.1, 3, 0.1), glassPlain);
  neck.position.y = b.h + 0.1;
  hang.add(neck);

  // Cap: main block with the logo, vented sides and a narrower vented lid. The cap
  // and cord live in their own group so the cap can be unscrewed as one piece.
  const capGroup = new THREE.Group();
  hang.add(capGroup);
  const mats = capMaterials(bottle.cap || "black");
  const capY = b.h + CAP.gap;
  const block = new THREE.Mesh(new RoundedBoxGeometry(CAP.w, CAP.h, CAP.w, 5, CAP.r), [
    mats.side,
    mats.side,
    mats.plain,
    mats.plain,
    mats.logo,
    mats.logo,
  ]);
  block.position.y = capY + CAP.h / 2;
  capGroup.add(block);

  const lid = new THREE.Mesh(new RoundedBoxGeometry(CAP.lidW, CAP.lidH, CAP.lidW, 4, CAP.lidR), [
    mats.plain,
    mats.plain,
    mats.top,
    mats.plain,
    mats.plain,
    mats.plain,
  ]);
  lid.position.y = capY + CAP.h + CAP.lidH / 2 - 0.02;
  capGroup.add(lid);

  const capTop = capY + CAP.h + CAP.lidH;

  if (cord > 0) {
    const mat = cordMaterial();
    const beadY = capTop + Math.min(2.4, cord * 0.4);
    const top = capTop + cord + 0.5;
    const lower = (s) => [
      [s * 0.62, capTop - 0.3, 0.05],
      [s * 0.7, capTop + 0.28, 0.02],
      [s * 0.44, capTop + (beadY - capTop) * 0.55, 0],
      [s * 0.13, beadY - 0.26, 0],
      [s * 0.075, beadY, 0],
    ];
    for (const s of [-1, 1]) {
      const geo = strand([...lower(s), [s * 0.075, beadY + 0.5, 0], [s * 0.075, top, 0]]);
      capGroup.add(new THREE.Mesh(geo, mat));
    }
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 32, 20),
      new THREE.MeshPhysicalMaterial({ color: "#0e0e10", roughness: 0.2, clearcoat: 1 })
    );
    bead.scale.y = 0.85;
    bead.position.y = beadY;
    capGroup.add(bead);
  }

  hang.position.y = -(capTop + cord);
  root.userData = {
    hang,
    cap: capGroup,
    capY,
    capTop,
    dims: b,
    textured,
    neckTop: b.h + 0.3,
    height: capTop,
    width: b.w,
    bottom: -(capTop + cord),
    center: -(cord + capTop / 2),
  };
  return root;
}

/**
 * Perfume inside a bottle from buildBottle(), for the refill animation. It fills the
 * glass cavity from the bottom; set mesh.scale.y between 0 and 1 for the fill level.
 * Like the cavity, it is only seen through the glass.
 */
export function buildLiquid(root, color = "#e0a33c") {
  const { dims: b, textured, hang } = root.userData;
  const top = b.h - 0.14;
  const bottom = textured ? 0.5 : 0.62;
  const h = top - bottom;
  // Slightly wider than the cavity so it sits in front of the cavity walls.
  const geo = new RoundedBoxGeometry(b.w * 0.86, h, b.w * 0.86, 4, 0.18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + h / 2) / h;
    const k = 0.76 + 0.24 * t;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  const mesh = refractionOnly(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0, envMapIntensity: 0.8 }))
  );
  mesh.position.y = bottom;
  mesh.scale.y = 0.001;
  hang.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Refill bottle: small round bottle in smoky translucent plastic with a black
// ribbed screw cap and a pointed nozzle.

let ribTex = null;
function getRibs() {
  if (ribTex) return ribTex;
  const size = 256;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      height[y * size + x] = Math.pow(Math.abs(Math.sin((x / size) * Math.PI * 36)), 0.6);
    }
  }
  ribTex = dataTexture(normalCanvas(height, size, 3), { repeat: true });
  return ribTex;
}

export function buildRefill() {
  const root = new THREE.Group();
  const hang = new THREE.Group();
  root.add(hang);
  const R = 0.95;
  const bodyH = 3.6;

  // Body: a lathe profile with softly rounded base and shoulder.
  const prof = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    prof.push(new THREE.Vector2(R - 0.18 + Math.sin(a) * 0.18, 0.18 - Math.cos(a) * 0.18));
  }
  prof.push(new THREE.Vector2(R, bodyH - 0.12));
  prof.push(new THREE.Vector2(R - 0.04, bodyH));
  prof.push(new THREE.Vector2(0.6, bodyH + 0.05));
  prof.unshift(new THREE.Vector2(0, 0));
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(prof, 96),
    new THREE.MeshPhysicalMaterial({
      color: "#e9eeec",
      roughness: 0.18,
      transmission: 1,
      thickness: 1.6,
      ior: 1.45,
      attenuationColor: new THREE.Color("#7f8b85"),
      attenuationDistance: 2.4,
      envMapIntensity: 1.3,
    })
  );
  hang.add(body);

  const inner = refractionOnly(
    new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.86, R * 0.86, bodyH - 0.5, 48),
      new THREE.MeshBasicMaterial({ map: getWallTexture(), toneMapped: false })
    )
  );
  inner.position.y = bodyH / 2 + 0.05;
  hang.add(inner);

  const black = new THREE.MeshPhysicalMaterial({ color: "#151517", roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.1, 64), black);
  collar.position.y = bodyH + 0.02;
  hang.add(collar);

  const ribMat = black.clone();
  ribMat.normalMap = getRibs();
  ribMat.normalScale = new THREE.Vector2(1.2, 1.2);
  const capH = 1.55;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.06, capH, 96, 1), [ribMat, black, black]);
  cap.position.y = bodyH + 0.12 + capH / 2;
  hang.add(cap);

  const nozzleProfile = [
    [0, 0],
    [R + 0.02, 0],
    [R - 0.02, 0.08],
    [0.74, 0.22],
    [0.66, 0.34],
    [0.2, 1.28],
    [0.13, 1.36],
    [0, 1.38],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const nozzle = new THREE.Mesh(new THREE.LatheGeometry(nozzleProfile, 64), black);
  nozzle.position.y = bodyH + 0.12 + capH;
  hang.add(nozzle);

  const height = bodyH + 0.12 + capH + 1.38;
  root.userData = { hang, height, tip: height, width: 2 * R, bottom: 0, center: height / 2 };
  return root;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
}

// ---------------------------------------------------------------------------
// Studio: renderer, lighting, the refraction backdrop and framing

export function createRenderer(canvasEl, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    ...opts,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  return renderer;
}

// A photo studio for reflections: light gray walls, a big overhead softbox, two
// tall strip lights, a front fill, and black flags behind for edge definition.
function studioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 16, 24),
    new THREE.MeshBasicMaterial({ color: "#8d8f93", side: THREE.BackSide })
  );
  room.position.y = 3;
  env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: "#c9cbce" }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.9;
  env.add(floor);
  const panel = (w, h, intensity, pos, lookAt = [0, 0, 0], color = "#ffffff") => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(...pos);
    p.lookAt(...lookAt);
    env.add(p);
  };
  panel(9, 7, 4.5, [0, 10.5, 1], [0, 0, 0]); // overhead softbox
  panel(1.6, 10, 7, [-8, 1.5, -0.5], [0, 1, 0]); // strip left, catches edges only
  panel(1.4, 10, 5, [8, 1.5, -1.5], [0, 1, 0]); // strip right
  panel(1.2, 7, 2.2, [4.5, 2, 10], [0, 1, 0]); // thin front strip for a highlight line
  panel(3, 11, 0, [-6, 1, -7], [0, 1, 0], "#000000"); // flags
  panel(3, 11, 0, [6, 1, -7], [0, 1, 0], "#000000");
  return env;
}

// What the glass "sees" behind itself: the page color in the middle, darkening to
// charcoal just past the bottle's edges. Attached to the camera, so it stays behind
// the bottle, and drawn only into the transmission buffer.
function refractionBackdrop(background) {
  const size = 512;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const bg = new THREE.Color(background);
  const img = ctx.createImageData(size, size);
  const dark = new THREE.Color("#2a2c2f");
  const col = new THREE.Color();
  for (let y = 0; y < size; y++) {
    const vy = Math.abs(y / size - 0.5) * 2;
    for (let x = 0; x < size; x++) {
      const vx = Math.abs(x / size - 0.5) * 2;
      const k = Math.max(smooth(0.28, 0.62, vx), smooth(0.55, 0.95, vy) * 0.6);
      col.copy(bg).lerp(dark, k * 0.85);
      const i = (y * size + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const mesh = refractionOnly(
    new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: dataTexture(c, { srgb: true }), toneMapped: false })
    )
  );
  mesh.renderOrder = -1;
  return mesh;
}

export function createStudio(renderer, background = "#ffffff") {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = studioEnvironment();
  scene.environment = pmrem.fromScene(env, 0.02).texture;
  disposeObject(env);
  pmrem.dispose();

  const key = new THREE.DirectionalLight("#ffffff", 1.4);
  key.position.set(-4, 8, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffffff", 1.2);
  rim.position.set(6, 3, -6);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
  const backdrop = refractionBackdrop(background);
  camera.add(backdrop);
  camera.userData.backdrop = backdrop;
  scene.add(camera);
  return { scene, camera };
}

function placeBackdrop(camera, root, dist, viewCenterY) {
  const backdrop = camera.userData.backdrop;
  if (!backdrop) return;
  const { width, height } = root.userData;
  const bottleCenter = root.position.y + root.userData.bottom + height / 2;
  const depth = dist + 4;
  const k = depth / dist;
  backdrop.position.set(0, (bottleCenter - viewCenterY) * k, -depth);
  backdrop.scale.set(width * 2.1 * k, height * 1.9 * k, 1);
}

/**
 * Point the camera so a hanging bottle fills `fill` of the view height and sits
 * `bottom` (fraction of view height) above the lower edge. The cord runs off the top.
 */
export function frameHanging(camera, root, aspect, { fill = 0.45, bottom = 0.08, spread = 2.1 } = {}) {
  const { height, bottom: yBottom, width } = root.userData;
  let viewH = height / fill;
  // Keep enough width for the bottle to swing and twist on narrow canvases.
  const minW = width * spread;
  if (viewH * aspect < minW) viewH = minW / aspect;
  const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const centerY = yBottom - bottom * viewH + viewH / 2;
  camera.aspect = aspect;
  camera.position.set(0, centerY, dist);
  camera.lookAt(0, centerY, 0);
  camera.updateProjectionMatrix();
  placeBackdrop(camera, root, dist, centerY);
}

/** Standing product shot framing (no cord), centered with a little headroom. */
export function frameStanding(camera, root, aspect, { fill = 0.62 } = {}) {
  const { height, width } = root.userData;
  let viewH = height / fill;
  if (viewH * aspect < width / fill) viewH = width / fill / aspect;
  const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const cy = root.position.y + root.userData.bottom + height * 0.47;
  camera.aspect = aspect;
  camera.position.set(0, cy + dist * 0.14, dist);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
  placeBackdrop(camera, root, dist, cy);
}

/** Soft contact shadow for standing shots, tinted by the glass color. */
export function contactShadow(color = "#000000", size = 7) {
  const c = canvas(256, 256);
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},0.5)`);
  g.addColorStop(0.35, `rgba(${rgb},0.2)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size * 0.6),
    new THREE.MeshBasicMaterial({
      map: dataTexture(c, { srgb: true }),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * Glossy-floor reflection for standing shots: a mirrored copy of the bottle under a
 * floor in the background color that fades it out with distance.
 */
export function floorReflection(root, background = "#ffffff") {
  const group = new THREE.Group();
  const mirror = root.clone(true);
  // clone() drops onBeforeRender hooks; copy them so refraction-only parts stay hidden.
  const src = [];
  root.traverse((o) => src.push(o));
  let i = 0;
  mirror.traverse((o) => {
    o.onBeforeRender = src[i++].onBeforeRender;
  });
  mirror.scale.y = -1;
  mirror.position.y = -root.position.y;
  group.add(mirror);

  const size = 512;
  const c = canvas(size, size);
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const bg = new THREE.Color(background);
  const rgb = `${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},0.74)`);
  g.addColorStop(0.12, `rgba(${rgb},0.9)`);
  g.addColorStop(0.3, `rgba(${rgb},1)`);
  g.addColorStop(1, `rgba(${rgb},1)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({
      map: dataTexture(c, { srgb: true }),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.renderOrder = 1;
  group.add(floor);
  return group;
}

export const DIMENSIONS = { BODY, CAP };
