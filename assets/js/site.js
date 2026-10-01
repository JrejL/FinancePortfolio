// George Murad portfolio: accessible controls plus GSAP motion that always leaves a usable static page.
(function () {
 "use strict";
 window.__site = true;
 var motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
 var reduce = motionPreference.matches;
 var motionEnabled = false;
 var menuMotion = function () {};
 var root = document.documentElement;
 var q = function (s, root) { return (root || document).querySelector(s); };
 var qa = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
 if (reduce || !window.gsap || !window.ScrollTrigger) root.classList.remove("motion");
 if (reduce) {
  qa("video[autoplay]").forEach(function (video) {
   video.removeAttribute("autoplay");
   video.pause();
   video.currentTime = 0;
  });
 }
 qa(".clip").forEach(function (figure) {
  var video = q("video", figure);
  var button = q(".clip__toggle", figure);
  if (!video || !button) return;
  var sync = function () {
   var playing = !video.paused && !video.ended;
   button.textContent = playing ? "Pause" : "Play";
   button.setAttribute("aria-label", (playing ? "Pause" : "Play") + " the clip");
  };
  button.addEventListener("click", function () {
   if (video.paused || video.ended) video.play(); else video.pause();
  });
  ["play", "pause", "ended"].forEach(function (eventName) { video.addEventListener(eventName, sync); });
  if (root.classList.contains("js")) {
   video.removeAttribute("controls");
   if (!reduce) {
    var playing = video.play();
    if (playing && playing.catch) playing.catch(sync);
   }
  }
  sync();
 });
 // Copy buttons: clipboard where allowed, a selection fallback otherwise.
 qa("[data-copy]").forEach(function (button) {
  var text = button.getAttribute("data-copy"), done = function () { button.textContent = "Copied"; setTimeout(function () { button.textContent = "Copy"; }, 1800); };
  var fallback = function () {
   var area = document.createElement("textarea"); area.value = text; area.setAttribute("readonly", ""); area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
   document.body.appendChild(area); area.select();
   var ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
   area.remove();
   if (ok) done(); else { button.textContent = "Select and copy"; var code = button.previousElementSibling; if (code) { var range = document.createRange(); range.selectNodeContents(code); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); } }
  };
  button.addEventListener("click", function () {
   if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });
 });
 // Phone menu. GSAP enhances the drop, but the class is the complete fallback.
 var menuToggle = q(".menu-toggle");
 var menu = q("#menu");
 if (menuToggle && menu) {
  var closeMenu = function () {
   menu.classList.remove("is-open");
   menuToggle.setAttribute("aria-expanded", "false");
   menuToggle.textContent = "Menu";
  };
  menuToggle.addEventListener("click", function () {
   var open = !menu.classList.contains("is-open");
   if (!open) { closeMenu(); return; }
   menu.classList.add("is-open");
   menuToggle.setAttribute("aria-expanded", "true");
   menuToggle.textContent = "Close";
   menuMotion(menu);
  });
  menu.addEventListener("click", function (event) { if (event.target.closest("a")) closeMenu(); });
  window.addEventListener("resize", function () { if (window.innerWidth > 900) closeMenu(); });
 }
 var tableHints = function () {
  qa(".fin-wrap").forEach(function (wrap) {
   var overflow = wrap.scrollWidth > wrap.clientWidth + 1;
   var next = wrap.nextElementSibling;
   var hasHint = next && next.classList.contains("table-hint");
   if (overflow) {
    var caption = q("caption", wrap);
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", (caption ? caption.textContent : "Table") + ", scrolls sideways");
   } else {
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("role");
    wrap.removeAttribute("aria-label");
   }
   if (overflow && !hasHint) {
    var hint = document.createElement("p");
    hint.className = "table-hint";
    hint.textContent = "Scroll sideways to see every column.";
    wrap.insertAdjacentElement("afterend", hint);
   } else if (!overflow && hasHint) next.remove();
  });
 };
 tableHints();
 if (document.fonts) document.fonts.ready.then(tableHints);
 var hintTimer;
 window.addEventListener("resize", function () { clearTimeout(hintTimer); hintTimer = setTimeout(tableHints, 150); });
 var animatePanel = function () {};
 qa("[data-tabs]").forEach(function (group) {
  var buttons = qa('[role="tab"]', group);
  var select = function (button, focus) {
   var selectedPanel;
   buttons.forEach(function (candidate) {
    var selected = candidate === button;
    candidate.setAttribute("aria-selected", selected ? "true" : "false");
    candidate.tabIndex = selected ? 0 : -1;
    var panel = document.getElementById(candidate.getAttribute("aria-controls"));
    if (panel) {
     panel.hidden = !selected;
     if (selected) selectedPanel = panel;
    }
   });
   tableHints();
   if (selectedPanel) animatePanel(selectedPanel);
   if (focus) button.focus();
  };
  buttons.forEach(function (button, index) {
   button.addEventListener("click", function () { select(button); });
   button.addEventListener("keydown", function (event) {
    var next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1
     : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(buttons[(next + buttons.length) % buttons.length], true);
   });
  });
  if (buttons.length) select(buttons[0]);
 });
 var contentsLinks = qa(".toc a[href^='#'],.local-nav a[href^='#']");
 if (contentsLinks.length && "IntersectionObserver" in window) {
  var byId = {};
  contentsLinks.forEach(function (link) { var id = link.getAttribute("href").slice(1); (byId[id] || (byId[id] = [])).push(link); });
  var spy = new IntersectionObserver(function (entries) {
   entries.forEach(function (entry) {
    if (!entry.isIntersecting) return;
    contentsLinks.forEach(function (link) { link.classList.remove("is-active"); });
    if (byId[entry.target.id]) byId[entry.target.id].forEach(function (link) { link.classList.add("is-active"); });
   });
  }, { rootMargin: "-20% 0px -70% 0px" });
  Object.keys(byId).forEach(function (id) { var section = document.getElementById(id); if (section) spy.observe(section); });
 }
 qa("[data-year]").forEach(function (element) { element.textContent = new Date().getFullYear(); });
 if (window.location.hash) {
  try {
   var hashTarget = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
   if (hashTarget) hashTarget.scrollIntoView({ behavior: "instant" });
  } catch (error) { /* A malformed fragment should not block the static page. */ }
 }
 var hero = q(".hero");
 var stage = q(".hero-stage");
 var top = q(".top");
 if (hero && top) {
  top.classList.add("is-scrolled");
  if ("IntersectionObserver" in window) {
   new IntersectionObserver(function (entries) {
    top.classList.toggle("is-scrolled", !entries[0].isIntersecting);
   }).observe(hero);
  }
 }
 var wipe = q(".page-wipe");
 var navigationTimer;
 var navigating = false;
 window.addEventListener("pageshow", function (event) {
  if (!event.persisted) return;
  clearTimeout(navigationTimer);
  navigating = false;
  if (wipe) {
   if (motionEnabled && window.gsap) window.gsap.killTweensOf(wipe);
   wipe.style.transform = "translateX(110%)";
  }
 });
 var context;
 var restorers = [];
 var splits = [];
 var stopMotion = function () {
  motionEnabled = false;
  root.classList.remove("motion", "motion-ready");
  menuMotion = animatePanel = function () {};
  if (context) context.revert();
  splits.forEach(function (split) { split.revert(); });
  restorers.forEach(function (restore) { restore(); });
  qa(".reveal-pending,.is-animating,.pointer-card,.pointer-button").forEach(function (el) {
   el.classList.remove("reveal-pending", "is-animating", "pointer-card", "pointer-button");
  });
  qa(".card-sheen").forEach(function (el) { el.remove(); });
  if (wipe) wipe.style.transform = "translateX(110%)";
 };
 motionPreference.addEventListener("change", function (event) {
  if (!event.matches) return;
  stopMotion();
  qa("video").forEach(function (video) { video.pause(); });
 });
 if (reduce || !window.gsap || !window.ScrollTrigger || !root.classList.contains("motion")) return;
 var gsap = window.gsap;
 var ScrollTrigger = window.ScrollTrigger;
 var plugins = [ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
 // Later ScrollTrigger callbacks and interactions join the same revertible context as setup.
 var safely = function (fn) {
  return function () {
   if (!motionEnabled) return;
   var args = arguments;
   try { context.add(function () { fn.apply(null, args); }); }
   catch (error) { stopMotion(); }
  };
 };
 try {
  gsap.registerPlugin.apply(gsap, plugins);
  context = gsap.context(function () {}, document.body);
  motionEnabled = true;
  root.classList.add("motion-ready");
  context.add(function () {
   var array = function (targets) { return gsap.utils.toArray(targets); };
   var mark = function (targets) { array(targets).forEach(function (el) { el.classList.add("is-animating"); }); };
   var clear = function (targets) { array(targets).forEach(function (el) { el.classList.remove("is-animating"); }); };
   var stagger = function (count, step, cap) { return Math.min(step, cap / Math.max(1, count - 1)); };
   var viewportState = function (el) {
    if (!el || el.closest("[hidden]")) return "hidden";
    var rect = el.getBoundingClientRect();
    if (rect.bottom <= 0) return "above";
    return rect.top < window.innerHeight ? "visible" : "below";
   };
   var reveal = function (el, start, animate) {
    var state = viewportState(el);
    if (state === "above" || state === "hidden") return;
    if (state === "visible") { animate(el); return; }
    el.classList.add("reveal-pending");
    ScrollTrigger.create({ trigger: el, start: start, once: true, toggleActions: "play none none none",
     onEnter: safely(function () { el.classList.remove("reveal-pending"); if (!el.matches(":focus-within")) animate(el); }) });
   };
   var batch = function (targets, start, animate) {
    var visible = [], below = [];
    array(targets).forEach(function (el) {
     var state = viewportState(el);
     if (state === "visible") visible.push(el);
     if (state === "below") { el.classList.add("reveal-pending"); below.push(el); }
    });
    if (visible.length) animate(visible);
    if (below.length) ScrollTrigger.batch(below, { start: start, once: true, toggleActions: "play none none none",
     onEnter: safely(function (els) {
      els.forEach(function (el) { el.classList.remove("reveal-pending"); });
      var entering = els.filter(function (el) { return !el.matches(":focus-within"); });
      if (entering.length) animate(entering);
     }) });
   };
   var rise = function (els, vars) {
    if (!els.length) return;
    mark(els);
    gsap.from(els, Object.assign({ y: 24, opacity: 0, duration: 1.15,
     stagger: stagger(els.length, .1, .8), ease: "power3.out",
     onComplete: function () { clear(els); } }, vars || {}));
   };
   var draw = function (paths, duration, position, timeline) {
    if (!paths.length || !window.DrawSVGPlugin) return;
    (timeline || gsap.timeline()).fromTo(paths, { drawSVG: "0%" }, {
     drawSVG: "100%", duration: duration, stagger: stagger(paths.length, .035, .15), ease: "power2.out"
    }, position || 0);
   };
   // Keep punctuation untouched. Only the digits acquire strips; the original is always the accessible text.
   var odometer = function (el) {
    if (!el || el.dataset.rolled) return;
    var original = el.textContent;
    if (!/^([−+\-]?\s*[$€£]?|[$€£]\s*[−+\-]?)(\d[\d,]*(?:\.\d+)?)(.*)$/.test(original.trim())) return;
    el.dataset.rolled = "true";
    var accessible = document.createElement("span");
    accessible.className = "sr-only";
    accessible.textContent = original;
    var valueWrap = document.createElement("span");
    valueWrap.className = "odo-value";
    valueWrap.setAttribute("aria-hidden", "true");
    var placeholder = document.createElement("span");
    placeholder.className = "odo-placeholder";
    placeholder.textContent = original;
    var visual = document.createElement("span");
    visual.className = "odometer";
    var strips = [];
    original.split("").forEach(function (char) {
     var digit = document.createElement("span");
     if (/\d/.test(char)) {
      digit.className = "odo-digit";
      var strip = document.createElement("span");
      strip.className = "odo-strip";
      var steps = 10 + Number(char);
      for (var i = 0; i <= steps; i++) {
       var number = document.createElement("span");
       number.textContent = i % 10;
       strip.appendChild(number);
      }
      digit.appendChild(strip);
      strips.push({ el: strip, steps: steps });
     } else { digit.className = "odo-literal"; digit.textContent = char; }
     visual.appendChild(digit);
    });
    var restore = function () { el.textContent = original; };
    restorers.push(restore);
    valueWrap.appendChild(placeholder);
    valueWrap.appendChild(visual);
    el.replaceChildren(accessible, valueWrap);
    var roll = gsap.timeline({ onComplete: restore });
    strips.forEach(function (strip, index) {
     roll.to(strip.el, { y: -(strip.steps * 1.15) + "em", duration: 1.4, ease: "power3.inOut" },
      (strips.length - index - 1) * Math.min(.07, .5 / Math.max(1, strips.length - 1)));
    });
   };
   // Words retain their original nested emphasis and accessible heading text.
   var wordsIn = function (element, cls) {
    var original = element.innerHTML, label = element.textContent, paragraph = element.matches("p");
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = [], node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (text) {
     var fragment = document.createDocumentFragment();
     text.textContent.split(/(\s+)/).forEach(function (word) {
      if (/^\s+$/.test(word)) { fragment.appendChild(document.createTextNode(word)); return; }
      if (!word) return;
      var span = document.createElement("span"); span.className = cls; span.textContent = word;
      if (!paragraph) span.setAttribute("aria-hidden", "true"); fragment.appendChild(span);
     });
     text.replaceWith(fragment);
    });
    if (!paragraph) element.setAttribute("aria-label", label);
    restorers.push(function () { element.innerHTML = original; element.removeAttribute("aria-label"); });
    return qa("." + cls, element);
   };
   if (hero) {
    gsap.set(qa(".kicker,h1,.intro,.actions,.decision", hero), { visibility: "visible" });
    if (viewportState(hero) !== "above" && !location.hash) {
     var words = wordsIn(q("h1", hero), "word");
     mark(words);
     gsap.timeline({ onComplete: function () { clear(words); } })
      .from(q(".kicker", hero), { opacity: 0, y: 12, duration: 1.1 }, 0)
      .from(words, { y: -70, rotationX: -35, opacity: 0, duration: 1.5, stagger: .09, ease: "back.out(1.6)" }, .15)
      .from(q(".intro", hero), { y: 20, opacity: 0, duration: 1.2 }, 1.05)
      .from(q(".actions", hero), { y: 20, opacity: 0, duration: 1.1 }, 1.35);
    }
   }
   var sceneRoutes = [];
   var navHeight = function () { return top ? top.offsetHeight : 72; };
   var seek = function (trigger, value) {
    window.scrollTo({ top: value, left: 0, behavior: "instant" });
    ScrollTrigger.update();
    var tween = trigger.getTween(); if (tween) tween.progress(1);
   };
   var routeHash = function () {
    var id; try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    sceneRoutes.some(function (route) {
     if (route.el.id !== id) return false;
     seek(route.trigger, route.at === "end" ? route.trigger.end : route.trigger.start); return true;
    });
   };
   window.addEventListener("hashchange", function () { if (motionEnabled) routeHash(); });
   document.addEventListener("click", function (event) {
    if (!motionEnabled || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[href^="#"]');
    if (link && sceneRoutes.some(function (route) { return "#" + route.el.id === link.getAttribute("href"); })) {
     requestAnimationFrame(function () { if (motionEnabled) routeHash(); });
    }
   });
   var sparks = function (el, tl, at, duration) {
    draw(qa(".spark path", el), duration, at, tl);
    var details = qa(".detail-visual--ledger i", el), code = q(".detail-visual--code code", el);
    if (details.length) tl.fromTo(details, { scaleX: 0 }, { scaleX: 1, duration: duration, stagger: { amount: duration * .4 } }, at);
    if (code) tl.fromTo(code, { opacity: .4, y: 8 }, { opacity: 1, y: 0, duration: duration }, at);
    var bars = qa(".spark rect", el);
    if (bars.length) tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: duration, stagger: { amount: duration * .3 }, ease: "back.out(1.7)" }, at);
   };
   var gallery = q(".gallery-scene"), deck = q(".deck-scene"), product = q(".product-scene"), process = q(".process-scene");
   var processWords = process ? wordsIn(q(".shead p", process), "process-word") : [];
   var media = gsap.matchMedia();
   media.add({ desktop: "(min-width: 768px)", tall: "(min-height: 700px)", cinema: "(min-width: 1100px) and (min-height: 800px)", gallery: "(min-width: 768px) and (min-height: 760px)", all: "all" }, function (mm) {
    var cleanups = [], owned = [];
    var register = function (el, trigger, focus, at) {
     var route = { el: el, trigger: trigger, at: at }; sceneRoutes.push(route); owned.push(route);
     var onFocus = function (event) {
      if (!motionEnabled || !event.target.closest("a,button") || event.target.closest(".scene-pause")) return;
      focus(event.target, trigger);
     };
     el.addEventListener("focusin", onFocus);
     cleanups.push(function () { el.removeEventListener("focusin", onFocus); });
    };
    var toggleScene = function (el) { return function (self) { el.classList.toggle("scene-active", self.isActive); }; };
    if (hero && stage && mm.conditions.desktop) {
     hero.classList.add("is-scene", "scene-active");
     stage.classList.add("stage-scene");
     var strengthsSection = q(".section--strengths", stage), sHead = q(".shead", strengthsSection), cards = qa(".s-grid .s-card", strengthsSection);
     var extra = q(".stage-extra");
     // The full size grid runs below the stage; reserve that height so the next section starts after row 2.
     var sizeExtra = function () { extra.style.height = Math.max(0, strengthsSection.offsetHeight - stage.offsetHeight) + "px"; };
     sizeExtra();
     ScrollTrigger.addEventListener("refreshInit", sizeExtra);
     cleanups.push(function () { ScrollTrigger.removeEventListener("refreshInit", sizeExtra); extra.style.height = "0px"; });
     var cells = qa(".number-cell", hero), scene = q(".decision", hero), point = q(".decision__point", scene), flash = q(".decision__flash", scene);
     // Each card's flight is a delta from the point of light back to the card's own laid out slot in the grid
     // (it never moves in the DOM: .stage-scene already positions the grid over the hero). Measured fresh
     // whenever the timeline crosses time 0 or GSAP invalidates on resize, never resolved on every scrub frame.
     var cardDelta = function (i, axis) {
      var pointRect = point.getBoundingClientRect(), cardRect = cards[i].getBoundingClientRect();
      return axis === "x" ? (pointRect.left + pointRect.width / 2) - (cardRect.left + cardRect.width / 2)
                           : (pointRect.top + pointRect.height / 2) - (cardRect.top + cardRect.height / 2);
     };
     // Idle wander: each figure drifts on custom properties that its inner span turns into a transform, so it adds
     // to the cell's own position. --k damps it to nothing as the figure joins the spiral.
     var wanders = [], drift = { on: false };
     var syncWander = function () {
      var stop = hero.classList.contains("drift-paused") || document.hidden || !hero.classList.contains("scene-active");
      wanders.forEach(function (tween) { tween.paused(stop); });
     };
     var range = function (vw, vh) {
      return { "--wx": function (_, el) { return (Math.random() * 2 - 1) * innerWidth * (vw[0] + Math.random() * (vw[1] - vw[0])) / 100 * parseFloat(el.style.getPropertyValue("--near")); },
               "--wy": function (_, el) { return (Math.random() * 2 - 1) * innerHeight * (vh[0] + Math.random() * (vh[1] - vh[0])) / 100 * parseFloat(el.style.getPropertyValue("--near")); },
               "--wr": function () { return (Math.random() * 2 - 1) * 14; },
               "--ws": function () { return .82 + Math.random() * .4; } };
     };
     cells.forEach(function (cell) {
      // Wider, quicker drift than before (George: "animate them more").
      var vars = range([12, 20], [9, 15]);
      vars.duration = 4.5 + Math.random() * 3.5; vars.ease = "sine.inOut"; vars.repeat = -1; vars.repeatRefresh = true; vars.paused = true;
      var tween = gsap.to(cell, vars); tween.progress(Math.random() * .5);
      wanders.push(tween);
     });
     var onVisible = function () { syncWander(); };
     document.addEventListener("visibilitychange", onVisible);
     var cellState = cells.map(function (cell, i) {
      return { el: cell, alpha: parseFloat(cell.style.getPropertyValue("--alpha")), off: (i * 37 % 100) / 100 * .12, hx: 0, hy: 0, r0: 0, a0: 0 };
     });
     // One proxy tween drives every figure in polar terms around S, the center of the future grid: a whirlpool, radius
     // (1 - q)^1.6, all turning the same way, each figure on its own progress so they arrive as a stream.
     var swirl = { p: 0 };
     var homes = function () {
      var w = hero.clientWidth, h = hero.clientHeight;
      cellState.forEach(function (c) {
       c.hx = parseFloat(c.el.style.getPropertyValue("--x")) / 100 * w - w / 2; c.hy = parseFloat(c.el.style.getPropertyValue("--y")) / 100 * h - h / 2;
       c.r0 = Math.hypot(c.hx, c.hy); c.a0 = Math.atan2(c.hy, c.hx);
      });
     };
     var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
     var spiral = function () {
      var p = swirl.p, fade = clamp01((p - 1) / .08), lead = Math.min(p, 1);
      cellState.forEach(function (c) {
       var qq = clamp01((lead - c.off) / (1 - .12)), r = c.r0 * Math.pow(1 - qq, 1.6), a = c.a0 + 1.35 * Math.PI * qq;
       var dx = r * Math.cos(a) - c.hx, dy = r * Math.sin(a) - c.hy;
       c.el.style.setProperty("--k", (1 - clamp01(qq / .35)).toFixed(3));
       c.el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0) translate(-50%,-50%) scale(" + (1 - .75 * qq).toFixed(3) + ")";
       c.el.style.opacity = ((c.alpha + (.95 - c.alpha) * qq) * (1 - fade)).toFixed(3);
      });
     };
     var assembly = gsap.timeline({ scrollTrigger: { trigger: stage, start: function () { return "top " + navHeight(); }, end: function () { return "+=" + (innerHeight * 2); },
      pin: true, scrub: 1.5, anticipatePin: 1, invalidateOnRefresh: true, onRefreshInit: homes,
      onToggle: function (self) { toggleScene(hero)(self); syncWander(); } } });
     homes();
     assembly.set(cards, { opacity: 0, scale: .05, pointerEvents: "none",
       x: function (i) { return cardDelta(i, "x"); }, y: function (i) { return cardDelta(i, "y"); } }, 0)
      .set(sHead, { opacity: 0, y: 20 }, 0)
      .set([point, flash], { opacity: 0 }, 0)
      .to(q(".hero__copy", hero), { scale: .57, y: -10, duration: .9, ease: "power2.inOut" }, .1)
      .to(q(".hero__copy", hero), { opacity: 0, duration: .3, ease: "power2.in" }, 1.05)
      .to(qa(".hero__support,.hero__eyebrow", hero), { opacity: 0, y: -15, duration: .45 }, .08)
      .set(q(".actions", hero), { pointerEvents: "none" }, .45)
      .to(swirl, { p: 1.08, duration: .93, ease: "none", onUpdate: spiral }, .12)
      .fromTo(point, { opacity: 0, scale: .2 }, { opacity: 1, scale: 1, duration: .25, ease: "power2.in" }, .88)
      .to(point, { scale: 1.9, duration: .1, ease: "power2.out" }, 1.08)
      .to(point, { scale: 1, duration: .1, ease: "power2.in" }, 1.18)
      .fromTo(flash, { opacity: 0, scale: .25 }, { opacity: 1, scale: 1.1, duration: .1, ease: "power2.out" }, 1.14)
      .to(flash, { opacity: 0, scale: 3.2, duration: .18, ease: "power2.out" }, 1.24)
      .to(point, { opacity: 0, duration: .15 }, 1.28)
      .to(sHead, { opacity: 1, y: 0, duration: .5, ease: "power2.out" }, 1.45)
      .to(cards, { opacity: 1, scale: 1, x: 0, y: 0, duration: 1.2, stagger: { each: .07, from: "start" }, ease: "power3.out" }, 1.2)
      .to(q(".scene-pause", hero), { autoAlpha: 0, duration: .15 }, .8)
      // Clickable once they have landed, not at the very end of the pin (George: "arent clickable as they open").
      .set(cards, { pointerEvents: "auto" }, 1.4)
      .to({}, { duration: .3 }, 2.94);
     var trigger = assembly.scrollTrigger;
     syncWander();
     register(stage, trigger, function (target, trig) {
      if (target.closest(".s-card")) seek(trig, trig.end); else seek(trig, trig.start);
     }, "end");
     // The hero buttons glide the page: See My Strengths through the scene to its end, Contact Me to the footer.
     var glide = null;
     // While a glide runs, <html> carries is-gliding, so the 3D bottle waits (cp-init.js) instead of stalling it.
     var endGlide = function () { document.documentElement.classList.remove("is-gliding"); document.dispatchEvent(new CustomEvent("cp:glideend")); };
     var stopGlide = function () { if (glide) { glide.kill(); glide = null; endGlide(); } };
     var glideTo = function (target, done) {
      stopGlide();
      document.documentElement.classList.add("is-gliding");
      var y = { v: window.pageYOffset };
      var max = document.documentElement.scrollHeight - innerHeight;
      glide = gsap.to(y, { v: Math.max(0, Math.min(target, max)), duration: 2.4, ease: "power2.inOut",
       // "instant": the page has scroll-behavior: smooth, which turned every frame's step into its own smooth scroll,
       // restarted each frame, so the page sat still for the whole tween and then jumped at the end.
       onUpdate: function () { window.scrollTo({ top: y.v, left: 0, behavior: "instant" }); }, onComplete: function () { glide = null; endGlide(); if (done) done(); } });
     };
     var onGlideClick = function (event) {
      if (!motionEnabled || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest(".hero .actions a[href^='#']");
      if (!link) return;
      var id = link.getAttribute("href").slice(1), dest = document.getElementById(id);
      if (!dest) return;
      event.preventDefault();
      if (id === "strengths") {
       glideTo(trigger.end, function () {
        gsap.delayedCall(1.7, function () { var first = cards[0] && q("a", cards[0]); if (first && window.pageYOffset >= trigger.end - 4) first.focus({ preventScroll: true }); });
       });
      } else glideTo(dest.getBoundingClientRect().top + window.pageYOffset);
     };
     document.addEventListener("click", onGlideClick, true);
     ["wheel", "touchstart", "keydown"].forEach(function (name) { window.addEventListener(name, stopGlide, { passive: true }); });
     cleanups.push(function () {
      stopGlide(); document.removeEventListener("click", onGlideClick, true);
      ["wheel", "touchstart", "keydown"].forEach(function (name) { window.removeEventListener(name, stopGlide); });
      document.removeEventListener("visibilitychange", onVisible);
      wanders.forEach(function (tween) { tween.kill(); });
      cells.forEach(function (cell) { ["transform", "opacity", "--k", "--wx", "--wy", "--wr", "--ws"].forEach(function (name) { cell.style.removeProperty(name); }); });
     });
     var pause = q(".scene-pause", hero);
     var pauseDrift = function () { var off = hero.classList.toggle("drift-paused"); syncWander(); pause.textContent = off ? "Play" : "Pause"; pause.setAttribute("aria-pressed", String(off)); };
     pause.addEventListener("click", pauseDrift);
     cleanups.push(function () { pause.removeEventListener("click", pauseDrift); pause.textContent = "Pause"; pause.setAttribute("aria-pressed", "false"); });
    }
    // My Strengths and Practice Case Studies are simple grids now: cards fall into place as they enter, no pin.
    if (gallery) {
     batch(qa(".s-card", gallery), "top 85%", function (cards) { rise(cards, { y: -140, rotation: function (i) { return i % 2 ? 4 : -4; }, duration: 1.05, stagger: stagger(cards.length, .1, .5), ease: "bounce.out" });
      cards.forEach(function (card) { sparks(card, gsap.timeline(), .3, .65); }); });
    }
    if (deck) {
     batch(qa(".cases>li", deck), "top 88%", function (tiles) {
      rise(tiles, { z: -400, rotationX: 28, rotationY: function (i) { return i % 2 ? 12 : -12; }, transformPerspective: 1200, y: 70, duration: 1.2, stagger: stagger(tiles.length, .12, .35), ease: "power3.out" });
      tiles.forEach(function (tile) { odometer(q(".fig b", tile)); sparks(tile, gsap.timeline(), .3, .8); });
     });
    }
    // The process line and steps light up as they enter; no pin.
    if (process) {
     var pipe = q(".pipe", process), steps = qa(".pipe li", process);
     var processTL = gsap.timeline({ scrollTrigger: { trigger: process, start: "top 70%", end: "bottom 70%", scrub: 1,
      onUpdate: function () { if (!processTL) return; steps.forEach(function (step, i) { step.classList.toggle("is-lit", processTL.time() >= .8 + i * .3); }); } } });
     processTL.fromTo(processWords, { opacity: .5 }, { opacity: 1, stagger: { amount: 1 }, duration: .3, ease: "none" }, 0)
      .fromTo(pipe, { "--line-progress": 0 }, { "--line-progress": 1, duration: 1.5, ease: "none" }, .7);
     steps.forEach(function (step, i) { processTL.fromTo(step, { opacity: .75, y: 24 }, { opacity: 1, y: 0, duration: .3 }, .8 + i * .3); });
    }
    return function () {
     cleanups.forEach(function (fn) { fn(); });
     sceneRoutes = sceneRoutes.filter(function (route) { return owned.indexOf(route) < 0; });
     if (stage) stage.classList.remove("stage-scene");
     [hero, process].filter(Boolean).forEach(function (el) {
      el.classList.remove("is-scene", "scene-active", "drift-paused");
      qa(".reveal-pending,.is-animating,.is-lit", el).forEach(function (child) { child.classList.remove("reveal-pending", "is-animating", "is-lit"); });
     });
    };
   });
   // Velocity is an event contract, keeping the module independent of GSAP and custom globals.
   qa("[data-cp-stage]").forEach(function (stage) {
    ScrollTrigger.create({ start: 0, end: "max",
     onUpdate: function (self) { stage.dispatchEvent(new CustomEvent("cp:velocity", { detail: { velocity: Math.max(-3600, Math.min(3600, self.getVelocity())) } })); } });
   });
   document.addEventListener("cp:layout", safely(function () { ScrollTrigger.refresh(); }));
   qa(".shead").forEach(function (heading) {
    if (heading.closest(".process-scene")) return;
    reveal(heading, "top 88%", function () {
     gsap.from(q(".shead__rule", heading), { scaleX: 0, duration: 1.4, ease: "power2.out" });
     rise(qa(".n,p", heading), { duration: 1.1 });
     var title = q("h2", heading);
     if (window.SplitText) {
      splits.push(window.SplitText.create(title, { type: "lines", mask: "lines", linesClass: "heading-line", autoSplit: true,
       onSplit: function (self) {
        return gsap.from(self.lines, { yPercent: 110, duration: 1.3, stagger: .1, ease: "power3.out",
         onComplete: function () { self.revert(); } });
       } }));
     } else rise([title]);
    });
   });
   // On desktop the hero's pinned stage owns the strength cards' entrance (they fly from the hub); this plain
   // fall-in only runs where that scene did not engage, i.e. phones, where the grid sits in normal flow.
   if (!(stage && stage.classList.contains("stage-scene"))) {
    batch(qa(".s-grid .s-card").filter(function (card) { return !card.closest(".gallery-scene"); }), "top 88%", function (cards) {
     rise(cards, { y: window.innerWidth <= 680 ? -70 : -140, rotation: function (i) { return (i % 2 ? 1 : -1) * (4 + (i % 4) * 2); },
      duration: 1.5, stagger: stagger(cards.length, .16, .96), ease: "elastic.out(1,0.75)" });
    });
   }
   batch(qa(".cases > li").filter(function (card) { return !card.closest(".deck-scene"); }), "top 88%", function (rows) {
    // One direction for every card, a short rise with a slight settle; they used to slide in from alternating sides.
    rise(rows, { y: 44, scale: .97, duration: .9, stagger: stagger(rows.length, .08, .4), ease: "power3.out" });
    rows.forEach(function (row) {
     draw(qa(".spark path", row), 1.4);
     var bars = qa(".spark rect", row);
     if (bars.length) gsap.from(bars, { scaleY: 0, duration: 1.3, stagger: { amount: .5 }, ease: "back.out(1.7)" });
     odometer(q(".fig b", row));
    });
   });
   var animateTable = function (table) {
    if (table.dataset.animated || table.closest("[hidden]")) return;
    table.dataset.animated = "true";
    var regular = qa("tbody tr:not(.fin__subtotal):not(.fin__total)", table);
    var totals = qa("tbody tr.fin__subtotal,tbody tr.fin__total", table);
    var rows = regular.concat(totals);
    rise(rows, { y: -12, duration: .68, stagger: stagger(rows.length, .05, 1.2), ease: "power2.out" });
    var totalCells = qa(".fin__total > *", table);
    if (totalCells.length) gsap.fromTo(totalCells, { "--rule-scale": 0 }, { "--rule-scale": 1, duration: .9, delay: 1.3, ease: "power2.out" });
   };
   var animateChart = function (chart) {
    if (chart.dataset.animated || chart.closest("[hidden]")) return;
    chart.dataset.animated = "true";
    qa(".chart__svg", chart).forEach(function (svg) {
     var bars = qa(".chart__bar", svg);
     var lines = qa(".chart__line", svg);
     var dots = qa(".chart__dot", svg);
     var timeline = gsap.timeline();
     if (chart.classList.contains("chart--waterfall")) {
      if (bars.length) timeline.from(bars, { y: -42, opacity: 0, duration: 1.0, stagger: { amount: .8 }, ease: "back.out(1.7)" }, 0);
      var links = qa(".chart__link", svg);
      if (links.length) timeline.from(links, { opacity: 0, duration: .55, stagger: { amount: .9 } }, .35);
     } else if (bars.length) timeline.from(bars, { scaleY: 0, duration: 1.3, stagger: { amount: .55 }, ease: "back.out(1.7)" }, 0);
     draw(lines, 1.4, 0, timeline);
     if (dots.length) timeline.from(dots, { opacity: 0, scale: .3, transformOrigin: "50% 50%", duration: .4, stagger: stagger(dots.length, .06, .2), ease: "back.out(1.7)" }, 1.3);
     var values = qa(".chart__val", svg);
     if (values.length) timeline.from(values, { opacity: 0, duration: .4 }, 1.4);
    });
   };
   animatePanel = safely(function (panel) {
    qa(".fin", panel).forEach(animateTable);
    qa(".chart", panel).forEach(animateChart);
    ScrollTrigger.refresh();
   });
   qa(".fin-wrap").forEach(function (wrap) { reveal(wrap, "top 88%", function () { var table = q(".fin", wrap); if (table) animateTable(table); }); });
   qa(".chart").forEach(function (chart) { reveal(chart, "top 88%", function () { animateChart(chart); }); });
   batch(".kpi", "top 88%", function (tiles) {
    rise(tiles, { y: 22, duration: 1.0, stagger: stagger(tiles.length, .16, .6) });
    tiles.forEach(function (tile) { odometer(q("b", tile)); });
   });
   batch(".skills-list li", "top 88%", function (chips) { rise(chips, { y: 0, scale: .6, duration: .75, stagger: stagger(chips.length, .08, .6), ease: "back.out(1.7)" }); });
   batch(".work-card", "top 88%", function (cards) { rise(cards, { y: 34, duration: 1.1 }); });
   qa(".store-cover .clip__frame").forEach(function (frame) { reveal(frame, "top 88%", function () { gsap.from(frame, { scale: .92, duration: 1.4 }); }); });
   batch(".store-gallery .shot", "top 88%", function (shots) { rise(shots, { rotationX: 14, y: 60, scale: .94, duration: 1.4, stagger: stagger(shots.length, .2, .6) }); });
   qa(".store-gallery .shot").forEach(function (shot, i) {
    gsap.fromTo(shot, { "--drift-y": i % 2 ? 15 : -15 }, { "--drift-y": i % 2 ? -15 : 15, ease: "none",
     scrollTrigger: { trigger: shot, start: "top bottom", end: "bottom top", scrub: .6 } });
   });
   batch(".resume__sec", "top 88%", function (sections) { rise(sections, { y: 32, duration: 1.2 }); });
   batch(".job", "top 88%", function (jobs) { rise(jobs, { y: -28, duration: 1.0, stagger: stagger(jobs.length, .18, .8), ease: "back.out(1.25)" }); });
   qa(".cover").forEach(function (cover) {
    reveal(cover, "top 88%", function () {
     gsap.fromTo(cover, { "--cover-rule": 0 }, { "--cover-rule": 1, duration: 1.6 });
     rise(qa(".kicker,.strength-icon", cover), { duration: 1.4 });
     var title = q("h1", cover);
     if (window.SplitText) splits.push(window.SplitText.create(title, { type: "lines", mask: "lines", linesClass: "heading-line", autoSplit: true,
      onSplit: function (self) { return gsap.from(self.lines, { yPercent: 110, duration: 1.6, stagger: .2, ease: "power3.out", onComplete: function () { self.revert(); } }); } }));
     else rise([title], { y: 50, duration: 1.6 });
    });
   });
   qa(".contact,.foot").forEach(function (close) {
    var heading = q("h1,h2", close);
    reveal(heading, "top 88%", function () {
     var original = heading.innerHTML, label = heading.textContent;
     heading.setAttribute("aria-label", label); heading.replaceChildren();
     label.trim().split(/\s+/).forEach(function (word, index) {
      if (index) heading.appendChild(document.createTextNode(" "));
      var group = document.createElement("span"); group.className = "contact-word"; group.setAttribute("aria-hidden", "true");
      word.split("").forEach(function (char) { var letter = document.createElement("span"); letter.className = "letter"; letter.textContent = char; group.appendChild(letter); });
      heading.appendChild(group);
     });
     restorers.push(function () { heading.innerHTML = original; heading.removeAttribute("aria-label"); });
     gsap.from(qa(".letter", heading), { yPercent: 110, opacity: 0, duration: 1.3, stagger: { amount: 1.0 }, ease: "power3.out" });
     rise(qa(".intro,.magnetic-mail", close), { y: 24, duration: 1.3 });
     var line = q(".contact__line", close); if (line) gsap.from(line, { scaleX: 0, duration: 1.5, delay: .7 });
    });
   });
   // All Projects: each row rises as one piece, the panel first and its explanation just after.
   batch(qa(".proj-row"), "top 84%", function (rows) {
    rows.forEach(function (row, i) {
     rise([q(".proj-panel", row)], { y: 48, scale: .97, duration: .95, delay: i * .12 });
     rise(qa(".proj-about > *", row), { y: 22, duration: .9, delay: i * .12 + .15, stagger: .07 });
    });
   });
   var generic = qa("[data-reveal]").filter(function (el) {
    return !el.matches(".s-card,.shead,.chart,.shot,.clip,.contact,.resume__sec,.work-card,[data-tabs]") && !el.closest(".cases,.process-scene") && !q(".fin", el) && !el.matches(".pipe");
   });
   batch(generic, "top 88%", function (els) { rise(els); });
   qa(".glow").forEach(function (glow, i) {
    gsap.to(glow, { y: i ? -40 : 40, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .8 } });
   });
   var progress = q(".scroll-progress");
   if (progress) gsap.to(progress, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .2 } });
   menuMotion = safely(function (panel) {
    if (window.innerWidth <= 900) gsap.fromTo(panel, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: .28, clearProps: "transform,opacity" });
   });
   // Native navigation keeps its URL, history and fragment. Downloads and modified clicks stay native.
   if (wipe) {
    gsap.fromTo(wipe, { x: 0, xPercent: 0 }, { x: 0, xPercent: 110, duration: .35, ease: "power2.inOut" });
    document.addEventListener("click", function (event) {
     if (!motionEnabled || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
     var link = event.target.closest("a[href]");
     if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
     var url = new URL(link.href, window.location.href);
     if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol) || !/(\/|\.html)$/.test(url.pathname)) return;
     var path = function (pathname) { return pathname.replace(/index\.html$/, ""); };
     if (path(url.pathname) === path(window.location.pathname) && url.search === window.location.search) return;
     event.preventDefault();
     if (navigating) return;
     navigating = true;
     var leave = function () { clearTimeout(navigationTimer); window.location.assign(url.href); };
     navigationTimer = setTimeout(leave, 500);
     safely(function () {
      gsap.fromTo(wipe, { x: 0, xPercent: -101 }, { x: 0, xPercent: 0, duration: .35, ease: "power2.inOut", overwrite: true, onComplete: leave });
     })();
    });
   }
   ScrollTrigger.sort();
   ScrollTrigger.refresh();
   if (location.hash) routeHash();
   if (document.fonts) document.fonts.ready.then(function () { tableHints(); safely(function () { ScrollTrigger.refresh(); })(); });
  });
 } catch (error) {
  stopMotion();
 }
})();
