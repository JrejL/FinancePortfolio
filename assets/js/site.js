// George Murad, finance portfolio: menu, reveals, the hero statement, statement switches and the contents rail.
(function () {
  // The page head hides revealed content only while this script is expected; this tells it the script arrived.
  window.__site = true;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Banner clips play once; with reduced motion they hold on their poster instead.
  if (reduce) {
    document.querySelectorAll("video[autoplay]").forEach(function (v) {
      v.removeAttribute("autoplay");
      v.pause();
      v.currentTime = 0;
    });
  }

  // Clips play once; their button pauses them, or plays them again once they end.
  document.querySelectorAll(".clip").forEach(function (fig) {
    var v = fig.querySelector("video");
    var b = fig.querySelector(".clip__toggle");
    if (!v || !b) return;
    var sync = function () {
      var playing = !v.paused && !v.ended;
      b.textContent = playing ? "Pause" : "Play";
      b.setAttribute("aria-label", (playing ? "Pause" : "Play") + " the clip");
    };
    b.addEventListener("click", function () {
      if (v.paused || v.ended) v.play(); else v.pause();
    });
    ["play", "pause", "ended"].forEach(function (ev) { v.addEventListener(ev, sync); });
    sync();
  });

  // The figures ticker: a button to stop and restart it.
  var board = document.querySelector(".board");
  var boardToggle = board && board.querySelector(".board__toggle");
  if (boardToggle) {
    boardToggle.addEventListener("click", function () {
      var paused = board.classList.toggle("is-paused");
      boardToggle.setAttribute("aria-pressed", paused ? "true" : "false");
      boardToggle.textContent = paused ? "Play" : "Pause";
    });
  }

  // Menu on small screens
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Close" : "Menu";
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) { menu.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.textContent = "Menu"; }
    });
  }

  // One reveal recipe for everything marked data-reveal; charts, sparklines and the pipeline draw when revealed.
  var targets = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  }

  // The hero statement: figures count up, the total rule draws, then the stamp lands.
  var hero = document.querySelector(".hero");
  var ledger = document.querySelector(".ledger");
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var runLedger = function () {
    if (hero) hero.classList.add("is-live");
    if (!ledger) return;
    var cells = ledger.querySelectorAll("[data-count]");
    if (reduce) { ledger.classList.add("is-done"); return; }
    var start = null, dur = 1400;
    cells.forEach(function (c) { c.textContent = "0"; });
    var step = function (t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / dur);
      var k = 1 - Math.pow(1 - p, 3);
      cells.forEach(function (c) { c.textContent = fmt(Number(c.getAttribute("data-count")) * k); });
      if (p < 1) requestAnimationFrame(step);
      else setTimeout(function () { ledger.classList.add("is-done"); }, 150);
    };
    requestAnimationFrame(step);
  };
  if (hero) {
    if (document.readyState === "complete") setTimeout(runLedger, 250);
    else window.addEventListener("load", function () { setTimeout(runLedger, 250); });
  }

  // Statement switches (without scripts every statement shows, one after another)
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var buttons = group.querySelectorAll('[role="tab"]');
    var select = function (btn, focus) {
      buttons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        var p = document.getElementById(b.getAttribute("aria-controls"));
        if (p) p.hidden = !on;
      });
      if (window.__tableHints) window.__tableHints();
      if (focus) btn.focus();
    };
    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () { select(btn); });
      btn.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1
          : e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : null;
        if (j === null) return;
        e.preventDefault();
        select(buttons[(j + buttons.length) % buttons.length], true);
      });
    });
    if (buttons.length) select(buttons[0]);
  });

  // Contents rail: mark the chapter being read.
  var links = document.querySelectorAll(".toc a[href^='#']");
  if (links.length && "IntersectionObserver" in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("is-active"); });
        var a = byId[entry.target.id];
        if (a) a.classList.add("is-active");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  // A table wider than its column says so under it
  var hints = function () {
    document.querySelectorAll(".fin-wrap").forEach(function (w) {
      var over = w.scrollWidth > w.clientWidth + 1;
      var next = w.nextElementSibling;
      var has = next && next.classList.contains("table-hint");
      // A table that scrolls can be reached and scrolled from the keyboard
      if (over) {
        var cap = w.querySelector("caption");
        w.setAttribute("tabindex", "0");
        w.setAttribute("role", "region");
        w.setAttribute("aria-label", (cap ? cap.textContent : "Table") + ", scrolls sideways");
      } else if (w.hasAttribute("tabindex")) {
        w.removeAttribute("tabindex");
        w.removeAttribute("role");
        w.removeAttribute("aria-label");
      }
      if (over && !has) {
        var p = document.createElement("p");
        p.className = "table-hint";
        p.textContent = "Scroll sideways to see every column.";
        w.insertAdjacentElement("afterend", p);
      } else if (!over && has) {
        next.remove();
      }
    });
  };
  hints();
  window.__tableHints = hints;
  var hintTimer;
  window.addEventListener("resize", function () { clearTimeout(hintTimer); hintTimer = setTimeout(hints, 150); });

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
