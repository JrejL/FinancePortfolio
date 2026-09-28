// Only the two bottle pages load this gate. Phones and reduced motion never import three.js.
const preference = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 768px)");
const allowed = () => document.documentElement.classList.contains("js") && !preference.matches && desktop.matches && "IntersectionObserver" in window && "ResizeObserver" in window;
let source;
const load = () => source || (source = import("./cp-bottle-scene.js"));

document.querySelectorAll(".bottle-showcase").forEach((figure) => {
  const stage = figure.querySelector("[data-cp-stage]");
  const video = figure.querySelector("video"), pause = figure.querySelector(".cp-pause");
  const swatches = [...figure.querySelectorAll(".cp-swatch")];
  let near = false, pending = false, failed = false, requestedPause = false, controller, abort, generation = 0;
  const fallback = (reason = "static") => {
    figure.dataset.cpState = "fallback"; figure.dataset.cpReason = reason;
    const focused = figure.contains(document.activeElement) && document.activeElement.closest(".cp-controls,.cp-pause");
    const wasLive = figure.classList.contains("is-live");
    figure.classList.remove("is-live"); video.pause();
    if (wasLive) figure.dispatchEvent(new CustomEvent("cp:layout", { bubbles: true }));
    if (focused) figure.querySelector(".clip__toggle").focus({ preventScroll: true });
  };
  const stop = () => {
    generation++; pending = false; abort?.abort(); controller?.destroy(); controller = null; fallback();
    pause.textContent = "Pause"; pause.setAttribute("aria-pressed", "false");
  };
  const start = async () => {
    if (!allowed() || !near || failed || pending || controller) return;
    pending = true; figure.dataset.cpState = "loading"; const ticket = ++generation;
    try {
      const module = await load();
      if (ticket !== generation || !allowed()) return;
      abort = new AbortController();
      const next = await module.mountBottle(stage, {
        signal: abort.signal,
        onReady() {
          if (ticket !== generation || !allowed()) return;
          // Do not remove the fallback's native/custom control from under a keyboard user.
          const moveFocus = document.activeElement === figure.querySelector(".clip__toggle") || document.activeElement === video;
          video.pause(); figure.classList.add("is-live"); figure.dataset.cpState = "live"; delete figure.dataset.cpReason;
          if (moveFocus) pause.focus({ preventScroll: true });
          if (requestedPause) { controller?.pause(true); pause.textContent = "Play"; pause.setAttribute("aria-pressed", "true"); }
          figure.dispatchEvent(new CustomEvent("cp:layout", { bubbles: true }));
        },
        onFail(reason) { failed = true; stop(); figure.dataset.cpReason = reason; }
      });
      if (ticket !== generation || !allowed()) next.destroy();
      else controller = next;
    } catch (_) { if (ticket === generation) { failed = true; fallback("load"); } }
    finally { if (ticket === generation) pending = false; }
  };
  swatches.forEach((button, index) => {
    button.addEventListener("click", () => {
      if (!controller || !figure.classList.contains("is-live")) return;
      stage.dispatchEvent(new CustomEvent("cp:bottle", { detail: { bottle: button.dataset.bottle } }));
      swatches.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    });
    button.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? swatches.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); const target = swatches[(next + swatches.length) % swatches.length]; target.focus(); target.click();
    });
  });
  figure.querySelector(".clip__toggle").addEventListener("click", () => {
    queueMicrotask(() => { requestedPause = video.paused; });
  });
  pause.addEventListener("click", () => {
    if (!controller) return;
    const off = pause.getAttribute("aria-pressed") !== "true";
    requestedPause = off;
    pause.setAttribute("aria-pressed", String(off)); pause.textContent = off ? "Play" : "Pause"; controller.pause(off);
  });
  const change = () => { if (!allowed()) { stop(); figure.dataset.cpReason = preference.matches ? "reduced-motion" : !desktop.matches ? "phone" : "static"; } else start(); };
  preference.addEventListener("change", change); desktop.addEventListener("change", change);
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", () => { if (allowed()) start(); });
  if (!allowed()) figure.dataset.cpReason = preference.matches ? "reduced-motion" : !desktop.matches ? "phone" : "static";
  if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => { near = entry.isIntersecting; if (near) start(); }, { rootMargin: "400px 0px" }).observe(figure);
});
