// Portfolio adapter for George's supplied bottle model and rearview road.
// No film clock or automatic color cycle. The host owns eligibility, controls and fallback.
import { buildBottle, createRenderer, createStudio, disposeObject, frameHanging } from "cp-bottle-model";
import { RoadMirror } from "cp-road-mirror";

export const BOTTLES = [
  { id: "amethyst", name: "Amethyst", glass: "#8A58E6", textured: true, cap: "black", tint: "#ECE4FB" },
  { id: "rose", name: "Rose", glass: "#F28DB8", textured: true, cap: "black", tint: "#FBE6EE" },
  { id: "citrine", name: "Citrine", glass: "#F3C318", textured: true, cap: "black", tint: "#FBF1CF" },
  { id: "sapphire", name: "Sapphire", glass: "#3563E6", textured: true, cap: "black", tint: "#E1E8FB" },
  { id: "ruby", name: "Ruby", glass: "#E4524C", textured: true, cap: "black", tint: "#FAE0DE" },
  { id: "aqua", name: "Aqua", glass: "#22C3B8", textured: true, cap: "black", tint: "#D9F4F1" },
  { id: "cognac", name: "Cognac", glass: "#7E3C12", textured: true, cap: "black", tint: "#F2E4D8" },
  { id: "clear-black", name: "Onyx", glass: "#CBD9D1", textured: false, cap: "black", tint: "#EAECEA" },
  { id: "clear-gold", name: "Gold", glass: "#CBD9D1", textured: false, cap: "gold", tint: "#F4EEDD" },
  { id: "clear-silver", name: "Chrome", glass: "#CBD9D1", textured: false, cap: "silver", tint: "#E9ECF0" },
];
const bottleById = Object.fromEntries(BOTTLES.map((b) => [b.id, b]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

class HangingView {
  constructor(stage) {
    this.container = stage;
    this.canvas = document.createElement("canvas");
    this.renderer = createRenderer(this.canvas, { powerPreference: "default" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    // The model and its lighting were built for the store's white ground; a dark studio muddies the glass and cap.
    try { Object.assign(this, createStudio(this.renderer, "#ffffff")); }
    catch (error) { this.renderer.dispose(); throw error; }
    stage.appendChild(this.canvas);
    this.ax = this.vx = this.vz = this.vtwist = this.age = 0;
    this.az = .08; this.twist = -.5; this.spin = null; this.swing = true;
    this.swap(stage.dataset.bottle);
  }
  setBottle(id, animate = true) {
    if (!bottleById[id] || id === (this.spin ? this.spin.next : this.bottleId)) return;
    if (animate) this.spin = { t: 0, next: id, swapped: false };
    else { this.spin = null; this.swap(id); }
  }
  swap(id) {
    if (!bottleById[id]) return;
    if (this.root) { this.scene.remove(this.root); disposeObject(this.root); }
    this.bottleId = id;
    this.root = buildBottle(bottleById[id], { cord: 10 });
    this.scene.add(this.root); this.resize();
  }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h || !this.root) return;
    this.renderer.setSize(w, h, false);
    frameHanging(this.camera, this.root, w / h, { fill: .58, bottom: .06, spread: 2.8 });
  }
  step(dt, t, scrollVel, sideways = 0) {
    // Scrolling is the car accelerating: the bottle leans back, then swings.
    const lean = clamp(scrollVel / 9000, -0.3, 0.3);
    const w2 = 26;
    this.vx += (-w2 * (this.ax - lean) - 1.3 * this.vx) * dt;
    this.ax += this.vx * dt;
    // Changing lanes: the car moves over and the bottle swings out the other way, then
    // back as the car straightens up (sideways is the car's acceleration, + = right).
    const sway = this.swing ? 0.1 * Math.sin(t * 1.5) + 0.04 * Math.sin(t * 2.7 + 1) : 0.035 * Math.sin(t * 0.9);
    const lane = Math.atan(-sideways / 9.8) * 0.45;
    this.vz += (-w2 * (this.az - sway - lane) - 1.3 * this.vz) * dt;
    this.az += this.vz * dt;

    const idleTwist = -0.5 + 0.55 * Math.sin(t * 0.3);
    this.vtwist += (-2.2 * (this.twist - idleTwist) - 1.4 * this.vtwist) * dt;
    this.vtwist += scrollVel * 0.000012 - sideways * 0.05 * dt;
    this.twist += this.vtwist * dt;

    let spinAngle = 0;
    if (this.spin) {
      this.spin.t += dt / 1.3;
      const k = ease(Math.min(1, this.spin.t));
      spinAngle = k * Math.PI * 2;
      if (!this.spin.swapped && k > 0.5) {
        this.spin.swapped = true;
        this.swap(this.spin.next);
      }
      if (this.spin.t >= 1) this.spin = null;
    }

    this.root.rotation.x = this.ax;
    this.root.rotation.z = this.az;
    this.root.userData.hang.rotation.y = this.twist + spinAngle;
  }

  render(dt, time, velocity, sideways) {
    const k = Math.min(1, (this.age += dt) / 1.2);
    this.step(dt, time, velocity * k, sideways * k);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    disposeObject(this.scene);
    this.scene.environment?.dispose();
    this.camera.userData.backdrop?.material?.map?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

// One visible scene, one animation frame loop. No frame work while paused, off screen or in a hidden tab.
export async function mountBottle(stage, { onReady, onFail, signal }) {
  let view, mirror, resize, visibility, frameId = 0, last = 0, time = 0, velocity = 0;
  let visible = false, paused = false, disposed = false, ready = false, frames = 0, samples = 0, elapsed = 0;
  const rig = stage.closest(".ec-hero__rig"), glass = rig.querySelector(".ec-mirror-glass");
  const stop = () => { cancelAnimationFrame(frameId); frameId = 0; last = 0; };
  const fail = (reason = "render") => { destroy(); onFail(reason); };
  const start = () => {
    if (!disposed && ready && visible && !paused && !document.hidden && !frameId) frameId = requestAnimationFrame(frame);
  };
  const frame = (now) => {
    frameId = 0;
    if (disposed || !visible || paused || document.hidden) { last = 0; return; }
    const interval = last ? (now - last) / 1000 : 1 / 60;
    const dt = clamp(interval, .001, .05); last = now; time += dt;
    velocity *= Math.exp(-dt * 5);
    try {
      mirror?.tick(dt);
      view.render(dt, time, velocity, mirror?.accel || 0);
      if (++frames === 3) { stage.classList.add("is-live"); onReady(); }
      // After warm-up, sustained sub-32fps rendering gives way to the already present clip.
      if (frames > 90 && interval < .2) {
        samples++; elapsed += interval;
        if (samples >= 120) {
          if (elapsed / samples > .03125) { fail("performance"); return; }
          samples = 0; elapsed = 0;
        }
      }
    } catch (_) { fail(); return; }
    start();
  };
  const motion = (event) => { velocity = clamp(Number(event.detail?.velocity) || 0, -3600, 3600); };
  const choose = (event) => {
    const id = event.detail?.bottle;
    if (!bottleById[id] || disposed) return;
    try {
      stage.dataset.bottle = id; view.setBottle(id, !paused);
      if (paused) for (let i = 0; i < 3; i++) view.renderer.render(view.scene, view.camera);
      start();
    } catch (_) { fail(); }
  };
  const hidden = () => { if (document.hidden) stop(); else start(); };
  const contextLost = (event) => { event.preventDefault(); fail("context"); };
  function destroy() {
    if (disposed) return;
    disposed = true; stop(); resize?.disconnect(); visibility?.disconnect();
    document.removeEventListener("visibilitychange", hidden);
    signal?.removeEventListener("abort", destroy);
    stage.removeEventListener("cp:velocity", motion); stage.removeEventListener("cp:bottle", choose);
    view?.canvas.removeEventListener("webglcontextlost", contextLost);
    mirror?.dispose(); view?.dispose(); stage.classList.remove("is-live");
  }
  try {
    if (signal?.aborted) return { destroy, pause() {} };
    signal?.addEventListener("abort", destroy, { once: true });
    view = new HangingView(stage);
    mirror = glass ? new RoadMirror(glass) : null;
    resize = new ResizeObserver(() => {
      if (disposed) return;
      try { view.resize(); if (ready && paused) view.renderer.render(view.scene, view.camera); }
      catch (_) { fail(); }
    });
    resize.observe(stage);
    visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting; if (visible) start(); else stop();
    });
    visibility.observe(stage);
    view.canvas.addEventListener("webglcontextlost", contextLost);
    stage.addEventListener("cp:velocity", motion); stage.addEventListener("cp:bottle", choose);
    document.addEventListener("visibilitychange", hidden);
    if (view.renderer.compileAsync) await view.renderer.compileAsync(view.scene, view.camera);
    if (disposed) return { destroy, pause() {} };
    ready = true; start();
    return { destroy, pause(value) { paused = value; if (paused) stop(); else start(); } };
  } catch (error) { destroy(); throw error; }
}
