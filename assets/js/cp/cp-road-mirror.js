// The live view in the rearview mirror above a hanging Car Perfume: the road runs away
// behind you through the rear window, cars follow in the other lanes, and every few
// seconds the car changes lanes, so the whole view slides and turns in the glass.
// `accel` is the car's sideways acceleration (m/s², + = to the right); cp-bottle-scene.js
// uses it to swing the bottle the way a real one swings.
//
// The mirror shows the car's left on its left, like a real rearview mirror.

const LANE = 3.6; // lane width, m
const SPEED = 24; // our speed, m/s
const EYE = 1.25; // eye height above the road, m
const DASH = 3; // lane dash length, m
const PERIOD = 12; // dash + gap, m
const CHANGE = 2.6; // seconds for one lane change
const EDGE = 1.5 * LANE + 0.5; // road edge line, either side of the middle of the road
const TREES = 1.5 * LANE + 6; // tree line, either side
const TREE_GAP = 26; // m between trees
const COLORS = ["#f3f3f1", "#c43a31", "#23406f", "#b8bdc4", "#2a2c30", "#e2e4e6", "#3d6f8e", "#8d9299", "#6b1f2a"];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const laneX = (lane) => (lane - 1) * LANE;

export class RoadMirror {
  constructor(glass, { still = false } = {}) {
    this.glass = glass;
    this.still = still;
    this.canvas = document.createElement("canvas");
    glass.prepend(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.z = 0; // distance driven, m
    this.lane = 1; // 0 left, 1 middle, 2 right
    this.x = laneX(this.lane); // our sideways position, m
    this.vx = 0;
    this.accel = 0;
    this.change = null;
    this.wait = rand(2.2, 3.4); // seconds until the next lane change
    this.cars = [
      { lane: 0, d: 24, v: 0.4, aim: 0.4, color: COLORS[1] },
      { lane: 1, d: 15, v: -0.2, aim: -0.2, color: COLORS[0] },
      { lane: 2, d: 38, v: 0.8, aim: 0.8, color: COLORS[2] },
    ];
    this.visible = true;

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(glass);
    this.visibilityObserver = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    this.visibilityObserver.observe(glass);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.canvas.remove();
  }

  resize() {
    const w = this.glass.clientWidth;
    const h = this.glass.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.draw();
  }

  get active() {
    return this.visible && !document.hidden && !this.glass.closest(".ec-slide:not(.is-active)");
  }

  // Advance the drive by dt seconds and redraw. Returns false while off screen.
  tick(dt) {
    if (!this.active) {
      this.accel = 0;
      return false;
    }
    if (!this.still) this.drive(dt);
    this.draw();
    return true;
  }

  drive(dt) {
    this.z += SPEED * dt;

    // Lane changes: a smooth S-curve into the next lane, when that lane is clear behind.
    if (this.change) {
      const c = this.change;
      c.t = Math.min(1, c.t + dt / CHANGE);
      const s = c.t;
      const span = c.to - c.from;
      this.x = c.from + span * (s - Math.sin(2 * Math.PI * s) / (2 * Math.PI));
      this.vx = (span / CHANGE) * (1 - Math.cos(2 * Math.PI * s));
      this.accel = ((span * 2 * Math.PI) / (CHANGE * CHANGE)) * Math.sin(2 * Math.PI * s);
      if (s >= 1) {
        this.x = c.to;
        this.vx = 0;
        this.accel = 0;
        this.change = null;
        this.wait = rand(3.4, 6);
      }
    } else if ((this.wait -= dt) <= 0) {
      const options = [this.lane - 1, this.lane + 1].filter((l) => l >= 0 && l <= 2);
      const to = pick(options);
      const clear = !this.cars.some((c) => c.lane === to && c.d > -4 && c.d < 14);
      if (clear) {
        this.change = { from: this.x, to: laneX(to), t: 0 };
        this.lane = to;
      } else {
        this.wait = 0.8;
      }
    }

    // The cars behind: they drift closer and further back, now and then one overtakes,
    // and anything that passes us comes back far behind as a new car.
    for (const c of this.cars) {
      if (Math.random() < dt * 0.25) c.aim = rand(-1.2, 1.4);
      if (c.lane !== this.lane && Math.random() < dt * 0.05 && !this.cars.some((o) => o.aim > 3)) c.aim = rand(4, 6);
      const sameLane = c.lane === this.lane;
      if (sameLane && c.d < 12) c.aim = Math.min(c.aim, -1.5);
      if (c.d > 60) c.aim = Math.max(c.aim, 1.5);
      c.v += (c.aim - c.v) * Math.min(1, dt * 0.8);
      c.d -= c.v * dt;
      if (c.d < -6) {
        const lanes = [0, 1, 2].filter((l) => l !== this.lane && !this.cars.some((o) => o !== c && o.lane === l && o.d > 50));
        Object.assign(c, { lane: lanes.length ? pick(lanes) : this.lane, d: rand(70, 90), v: 1, aim: 1, color: pick(COLORS) });
      }
    }
  }

  // Road point (sideways X, distance behind d, height y) → mirror pixels, or null if behind the glass.
  project(X, d, y = 0) {
    const yaw = Math.atan2(this.vx, SPEED); // + = nose to the right
    const rel = X - this.x;
    const depth = d * Math.cos(yaw) - rel * Math.sin(yaw);
    if (depth < 0.5) return null;
    const side = rel * Math.cos(yaw) + d * Math.sin(yaw);
    return [this.cx + (this.f * side) / depth, this.hy + (this.f * (EYE - y)) / depth, this.f / depth];
  }

  quad(x1, x2, d1, d2, color) {
    const a = this.project(x1, d1);
    const b = this.project(x2, d1);
    const c = this.project(x2, d2);
    const e = this.project(x1, d2);
    if (!a || !b || !c || !e) return;
    const g = this.ctx;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.lineTo(e[0], e[1]);
    g.fill();
  }

  draw() {
    const { ctx: g, w, h } = this;
    if (!w || !h) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.cx = w / 2;
    this.hy = h * 0.42;
    this.f = h * 1.9;
    const yaw = Math.atan2(this.vx, SPEED);
    const vpx = this.cx + this.f * Math.tan(yaw);

    // Sky and the hills far behind (they only move when the car turns).
    const sky = g.createLinearGradient(0, 0, 0, this.hy);
    sky.addColorStop(0, "#9fbfdf");
    sky.addColorStop(1, "#e3ebf1");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, this.hy + 1);
    const hills = (k, amp, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, this.hy + 1);
      for (let sx = 0; sx <= w + 4; sx += 4) {
        const u = (sx - vpx) / this.f;
        const hgt = amp * (0.55 + 0.3 * Math.sin(u * 7 * k + k) + 0.15 * Math.sin(u * 19 * k + 2 * k));
        g.lineTo(sx, this.hy - hgt);
      }
      g.lineTo(w, this.hy + 1);
      g.fill();
    };
    hills(1, h * 0.09, "#b4c4c8");
    hills(1.7, h * 0.05, "#90a88e");

    // Ground, road and lines.
    const ground = g.createLinearGradient(0, this.hy, 0, h);
    ground.addColorStop(0, "#9fb487");
    ground.addColorStop(1, "#7d9868");
    g.fillStyle = ground;
    g.fillRect(0, this.hy, w, h - this.hy);
    this.quad(-EDGE - 1.2, EDGE + 1.2, 3, 3000, "#6d7178");
    this.quad(-EDGE - 1.2, EDGE + 1.2, 60, 3000, "rgba(160, 166, 174, 0.35)"); // haze
    this.quad(-EDGE - 0.08, -EDGE + 0.08, 3, 600, "rgba(255, 255, 255, 0.85)");
    this.quad(EDGE - 0.08, EDGE + 0.08, 3, 600, "rgba(255, 255, 255, 0.85)");
    const first = Math.floor((this.z - 160) / PERIOD);
    const last = Math.floor((this.z - 3) / PERIOD);
    for (let k = first; k <= last; k++) {
      const d1 = Math.max(3, this.z - k * PERIOD);
      const d2 = this.z - k * PERIOD + DASH;
      for (const X of [-LANE / 2, LANE / 2]) this.quad(X - 0.07, X + 0.07, d1, d2, "rgba(255, 255, 255, 0.9)");
    }

    // Trees and cars, furthest first.
    const things = [];
    const t0 = Math.floor((this.z - 400) / TREE_GAP);
    const t1 = Math.floor((this.z - 2) / TREE_GAP);
    for (let k = t0; k <= t1; k++) {
      const d = this.z - k * TREE_GAP;
      things.push({ d, draw: () => this.tree(-TREES - (k % 3), d, k) });
      things.push({ d: d + 9, draw: () => this.tree(TREES + ((k + 1) % 3), d + 9, k + 7) });
    }
    for (const c of this.cars) things.push({ d: c.d, draw: () => this.car(laneX(c.lane), c.d, c.color) });
    things.sort((a, b) => b.d - a.d).forEach((t) => t.d > 1 && t.draw());
  }

  tree(X, d, seed) {
    const base = this.project(X, d, 0);
    const top = this.project(X, d, 4.6 + (seed % 4) * 0.5);
    if (!base || !top) return;
    const g = this.ctx;
    const s = base[2];
    g.fillStyle = "#6b5a45";
    g.fillRect(base[0] - 0.12 * s, top[1], 0.24 * s, base[1] - top[1]);
    g.fillStyle = seed % 2 ? "#5d7d57" : "#4f7050";
    g.beginPath();
    g.ellipse(top[0], top[1], 1.7 * s, 2.1 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // A car coming up behind: we see its front, windshield and headlights.
  car(X, d, color) {
    const p = this.project(X, d, 0);
    if (!p) return;
    const g = this.ctx;
    const [x, y, s] = p;
    const bw = 1.8 * s;
    g.fillStyle = "rgba(20, 22, 26, 0.35)";
    g.beginPath();
    g.ellipse(x, y, bw * 0.62, 0.22 * s, 0, 0, Math.PI * 2);
    g.fill();
    // Body
    const bodyTop = y - 1.0 * s;
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(x - bw / 2, bodyTop, bw, 0.84 * s, 0.22 * s);
    g.fill();
    // Cabin and windshield
    const roof = y - 1.46 * s;
    g.beginPath();
    g.moveTo(x - 0.78 * s, bodyTop + 0.04 * s);
    g.lineTo(x - 0.58 * s, roof);
    g.lineTo(x + 0.58 * s, roof);
    g.lineTo(x + 0.78 * s, bodyTop + 0.04 * s);
    g.fill();
    g.fillStyle = "#26303b";
    g.beginPath();
    g.moveTo(x - 0.68 * s, bodyTop);
    g.lineTo(x - 0.52 * s, roof + 0.07 * s);
    g.lineTo(x + 0.52 * s, roof + 0.07 * s);
    g.lineTo(x + 0.68 * s, bodyTop);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    g.beginPath();
    g.moveTo(x - 0.5 * s, roof + 0.08 * s);
    g.lineTo(x - 0.18 * s, roof + 0.08 * s);
    g.lineTo(x - 0.42 * s, bodyTop);
    g.lineTo(x - 0.66 * s, bodyTop);
    g.fill();
    // Grille, headlights, bumper
    g.fillStyle = "#1c1d21";
    g.fillRect(x - 0.36 * s, y - 0.66 * s, 0.72 * s, 0.22 * s);
    g.fillStyle = "#fff6d8";
    g.beginPath();
    g.ellipse(x - 0.66 * s, y - 0.6 * s, 0.17 * s, 0.08 * s, 0, 0, Math.PI * 2);
    g.ellipse(x + 0.66 * s, y - 0.6 * s, 0.17 * s, 0.08 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(0, 0, 0, 0.28)";
    g.fillRect(x - bw / 2, y - 0.3 * s, bw, 0.14 * s);
    g.fillStyle = "#18191c";
    g.fillRect(x - bw * 0.46, y - 0.16 * s, 0.3 * s, 0.16 * s);
    g.fillRect(x + bw * 0.46 - 0.3 * s, y - 0.16 * s, 0.3 * s, 0.16 * s);
  }
}
