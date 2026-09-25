/* ACEBasicJS runtime — console I/O, TIMER, INPUT, SCREEN/WINDOW, RastPort graphics, turtle. */
(function (global) {
  "use strict";

  /** Workbench 2.0-ish default palette (RGB hex; PALETTE uses 0..1 components). */
  const DEFAULT_PALETTE = [
    "#0055aa", // 0 blue
    "#ffffff", // 1 white
    "#000000", // 2 black
    "#ff8800", // 3 orange
    "#aaaaaa", // 4 grey
    "#eeeeee", // 5 light
    "#000000", // 6
    "#ffffff", // 7
  ];

  const FONT_W = 8;
  const FONT_H = 8;
  const TITLEBAR_H = 18;

  function clamp01(n) {
    const x = Number(n);
    if (!isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function rgbToHex(r, g, b) {
    function byte(v) {
      const n = Math.round(clamp01(v) * 255);
      const h = n.toString(16);
      return h.length < 2 ? "0" + h : h;
    }
    return "#" + byte(r) + byte(g) + byte(b);
  }

  function parseHex(hex) {
    const h = String(hex || "#000000").replace("#", "");
    const full = h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h;
    return {
      r: parseInt(full.slice(0, 2), 16) || 0,
      g: parseInt(full.slice(2, 4), 16) || 0,
      b: parseInt(full.slice(4, 6), 16) || 0,
    };
  }

  function createRuntime(options) {
    const output = options && options.output;
    const screensHost = options && options.screensHost;
    const onInputRequest = options && options.onInputRequest;
    const onInputDone = options && options.onInputDone;
    const onDisplayChange = options && options.onDisplayChange;
    let inputLines = (options && options.inputLines) ? options.inputLines.slice() : null;
    let stopped = false;
    const startMs = Date.now();
    let pendingInput = null;
    let sleepWaiters = [];
    let keyQueue = [];
    let intuiMode = false;
    let currentScreenId = 0; // 0 = workbench / none
    let currentWindowId = 0; // 0 = shell/CLI
    const screens = Object.create(null); // id -> screen record
    const windows = Object.create(null); // id -> window record

    function notifyDisplay() {
      if (onDisplayChange) onDisplayChange({ intuiMode: intuiMode, screens: screens, windows: windows });
    }

    function wakeSleepers() {
      const waiters = sleepWaiters;
      sleepWaiters = [];
      for (let i = 0; i < waiters.length; i++) waiters[i]();
    }

    function currentWin() {
      return currentWindowId ? windows[currentWindowId] : null;
    }

    function screenForWin(win) {
      if (!win) return null;
      return screens[win.screenId] || null;
    }

    function paletteFor(win) {
      const scr = screenForWin(win);
      return (scr && scr.palette) || DEFAULT_PALETTE;
    }

    function penColor(win, id) {
      const pal = paletteFor(win);
      const idx = id | 0;
      return pal[idx] || pal[0] || "#000000";
    }

    function syncTextColor(win) {
      if (!win || !win.contentEl) return;
      win.contentEl.style.color = penColor(win, win.fgd);
    }

    /** Build a 256-entry RGB LUT for fast flush (avoids parseHex per pixel). */
    function paletteLut(pal) {
      const lut = new Uint8Array(256 * 3);
      for (let i = 0; i < 256; i++) {
        const rgb = parseHex(pal[i] || pal[0] || "#000000");
        const o = i * 3;
        lut[o] = rgb.r;
        lut[o + 1] = rgb.g;
        lut[o + 2] = rgb.b;
      }
      return lut;
    }

    function invalidatePaletteLut(scr) {
      if (scr) scr._palLut = null;
    }

    function flushRastPort(win) {
      if (!win || !win.ctx || !win.indices) return;
      const w = win.rpW;
      const h = win.rpH;
      const pal = paletteFor(win);
      const scr = screenForWin(win);
      let lut = scr && scr._palLut;
      if (!lut) {
        lut = paletteLut(pal);
        if (scr) scr._palLut = lut;
      }
      const img = win._imageData || (win._imageData = win.ctx.createImageData(w, h));
      const data = img.data;
      const indices = win.indices;
      for (let i = 0, p = 0; i < indices.length; i++, p += 4) {
        const o = (indices[i] & 255) * 3;
        data[p] = lut[o];
        data[p + 1] = lut[o + 1];
        data[p + 2] = lut[o + 2];
        data[p + 3] = 255;
      }
      win.ctx.putImageData(img, 0, 0);
      win._rpDirty = false;
    }

    function flushScreenWindows(sid) {
      for (const wid in windows) {
        const win = windows[wid];
        if (win && win.screenId === sid) flushRastPort(win);
      }
    }

    /**
     * Coalesce canvas blits: LINE/PSET/CIRCLE mark dirty; one rAF/timeout flush
     * serves a whole FOR-loop of drawing (lines.b was doing 2000 full-frame flushes).
     */
    let flushScheduled = false;
    function markDirty(win) {
      if (!win) return;
      win._rpDirty = true;
      if (flushScheduled) return;
      flushScheduled = true;
      const schedule = typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : function (cb) { setTimeout(cb, 0); };
      schedule(function () {
        flushScheduled = false;
        flushAllDirty();
      });
    }

    function flushAllDirty() {
      for (const wid in windows) {
        const win = windows[wid];
        if (win && win._rpDirty) flushRastPort(win);
      }
    }

    /** Ensure canvas matches indices before sleep / stop / tests that care about pixels. */
    function flushNow(win) {
      if (win) flushRastPort(win);
      else flushAllDirty();
    }

    function plotIndex(win, x, y, colorId) {
      const xi = x | 0;
      const yi = y | 0;
      if (!win || !win.indices) return;
      if (xi < 0 || yi < 0 || xi >= win.rpW || yi >= win.rpH) return;
      win.indices[yi * win.rpW + xi] = colorId & 255;
    }

    function getIndex(win, x, y) {
      const xi = x | 0;
      const yi = y | 0;
      if (!win || !win.indices) return -1;
      if (xi < 0 || yi < 0 || xi >= win.rpW || yi >= win.rpH) return -1;
      return win.indices[yi * win.rpW + xi];
    }

    /** Amiga area-pattern bit: MSB of each 16-bit word is leftmost pixel. */
    function areaPatBit(win, x, y) {
      const pat = win.areaPat;
      if (!pat || !pat.length) return 1;
      const h = pat.length;
      const row = (pat[((y % h) + h) % h] | 0) & 0xffff;
      const bit = 15 - (x & 15);
      return (row >> bit) & 1;
    }

    /** Plot with area pattern: bit1 → fg (APen), bit0 → bg (BPen). */
    function plotPatterned(win, x, y, fg, bg) {
      if (areaPatBit(win, x | 0, y | 0)) plotIndex(win, x, y, fg);
      else if (bg != null) plotIndex(win, x, y, bg);
    }

    /** Bresenham line into indexed buffer (honours line pattern). */
    function drawLineIndices(win, x0, y0, x1, y1, colorId) {
      let x = x0 | 0;
      let y = y0 | 0;
      const xEnd = x1 | 0;
      const yEnd = y1 | 0;
      const dx = Math.abs(xEnd - x);
      const dy = Math.abs(yEnd - y);
      const sx = x < xEnd ? 1 : -1;
      const sy = y < yEnd ? 1 : -1;
      let err = dx - dy;
      let pat = win.linePat != null ? (win.linePat & 0xffff) : 0xffff;
      let patCnt = win.linePatCnt != null ? win.linePatCnt : 15;
      for (;;) {
        if ((pat >> patCnt) & 1) plotIndex(win, x, y, colorId);
        patCnt = (patCnt - 1) & 15;
        if (x === xEnd && y === yEnd) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
      win.linePatCnt = patCnt;
    }

    function fillRectIndices(win, x1, y1, x2, y2, colorId) {
      const left = Math.min(x1, x2) | 0;
      const right = Math.max(x1, x2) | 0;
      const top = Math.min(y1, y2) | 0;
      const bottom = Math.max(y1, y2) | 0;
      const fg = colorId & 255;
      const bg = win.bgd & 255;
      const solid = !win.areaPat || win.areaPat.length === 0 ||
        (win.areaPat.length === 1 && (win.areaPat[0] & 0xffff) === 0xffff);
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          if (solid) plotIndex(win, x, y, fg);
          else plotPatterned(win, x, y, fg, bg);
        }
      }
    }

    function strokeRectIndices(win, x1, y1, x2, y2, colorId) {
      const left = Math.min(x1, x2) | 0;
      const right = Math.max(x1, x2) | 0;
      const top = Math.min(y1, y2) | 0;
      const bottom = Math.max(y1, y2) | 0;
      drawLineIndices(win, left, top, right, top, colorId);
      drawLineIndices(win, left, bottom, right, bottom, colorId);
      drawLineIndices(win, left, top, left, bottom, colorId);
      drawLineIndices(win, right, top, right, bottom, colorId);
    }

    /** Midpoint ellipse (aspect scales Y radius). */
    function drawEllipseIndices(win, cx, cy, rx, ry, colorId, startDeg, endDeg) {
      const rxn = Math.max(0, rx | 0);
      const ryn = Math.max(0, ry | 0);
      const full = (startDeg == null && endDeg == null) ||
        ((startDeg | 0) === 0 && (endDeg | 0) >= 359);
      if (full) {
        // Midpoint ellipse algorithm — plot 4-way symmetry.
        let x = 0;
        let y = ryn;
        let rx2 = rxn * rxn;
        let ry2 = ryn * ryn;
        let twoRx2 = 2 * rx2;
        let twoRy2 = 2 * ry2;
        let px = 0;
        let py = twoRx2 * y;
        function plot4(px, py) {
          plotIndex(win, cx + px, cy + py, colorId);
          plotIndex(win, cx - px, cy + py, colorId);
          plotIndex(win, cx + px, cy - py, colorId);
          plotIndex(win, cx - px, cy - py, colorId);
        }
        plot4(x, y);
        let p = Math.round(ry2 - rx2 * ryn + 0.25 * rx2);
        while (px < py) {
          x++;
          px += twoRy2;
          if (p < 0) p += ry2 + px;
          else {
            y--;
            py -= twoRx2;
            p += ry2 + px - py;
          }
          plot4(x, y);
        }
        p = Math.round(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2);
        while (y > 0) {
          y--;
          py -= twoRx2;
          if (p > 0) p += rx2 - py;
          else {
            x++;
            px += twoRy2;
            p += rx2 - py + px;
          }
          plot4(x, y);
        }
        return;
      }
      // Arc via parametric sampling (degrees, ACE-style).
      const a0 = (startDeg == null ? 0 : Number(startDeg)) * Math.PI / 180;
      const a1 = (endDeg == null ? 359 : Number(endDeg)) * Math.PI / 180;
      const steps = Math.max(16, Math.ceil(Math.max(rxn, ryn) * 4));
      let prevX = null;
      let prevY = null;
      for (let i = 0; i <= steps; i++) {
        const t = a0 + (a1 - a0) * (i / steps);
        const x = Math.round(cx + rxn * Math.cos(t));
        const y = Math.round(cy + ryn * Math.sin(t));
        if (prevX != null) drawLineIndices(win, prevX, prevY, x, y, colorId);
        prevX = x;
        prevY = y;
      }
    }

    function write(text) {
      if (stopped) return;
      const w = currentWindowId && windows[currentWindowId];
      if (intuiMode && w) {
        w.text += text;
        // Visual: coloured absolute runs so COLOR fg,bg + LOCATE (hi.b) look right.
        // Keep win.text as a plain buffer for windowText() / LOCATE padding.
        if (w.committedEl && typeof document !== "undefined") {
          paintWindowText(w, text);
        } else if (w.committedEl) {
          w.committedEl.textContent = w.text;
        } else if (w.contentEl) {
          w.contentEl.textContent = w.text;
        }
        // Advance text cursor / graphics pen with newlines / chars.
        for (let i = 0; i < text.length; i++) {
          const ch = text.charAt(i);
          if (ch === "\n") {
            w.cursorRow++;
            w.cursorCol = 1;
            w.penX = 0;
            w.penY = (w.cursorRow - 1) * FONT_H;
          } else {
            w.cursorCol++;
            w.penX += FONT_W;
          }
        }
        return;
      }
      if (output) output.textContent += text;
      else if (typeof console !== "undefined") {
        write._buf = (write._buf || "") + text;
        const parts = write._buf.split("\n");
        write._buf = parts.pop();
        for (let i = 0; i < parts.length; i++) console.log(parts[i]);
      }
    }

    /**
     * Paint PRINT into the window as absolutely positioned coloured spans.
     * LOCATE sets penX/penY; each run keeps its COLOR pens.
     */
    function paintWindowText(win, text) {
      if (!win.committedEl || !text) return;
      let x = win.penX;
      let y = win.penY;
      let buf = "";
      let bufX = x;
      let bufY = y;
      const fg = penColor(win, win.fgd);
      const bg = penColor(win, win.bgd);
      function flush() {
        if (!buf) return;
        const span = document.createElement("span");
        span.className = "ace-text-run";
        span.style.left = bufX + "px";
        span.style.top = bufY + "px";
        span.style.color = fg;
        span.style.backgroundColor = bg;
        span.textContent = buf;
        win.committedEl.appendChild(span);
        buf = "";
      }
      for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        if (ch === "\n") {
          flush();
          x = 0;
          y += FONT_H;
          bufX = x;
          bufY = y;
        } else {
          if (!buf) {
            bufX = x;
            bufY = y;
          }
          buf += ch;
          x += FONT_W;
        }
      }
      flush();
    }

    /** Active text surface for host INPUT UX: window content, or null → CLI console. */
    function activeTextSurface() {
      if (!intuiMode || !currentWindowId) return null;
      const w = windows[currentWindowId];
      return w && w.contentEl ? w.contentEl : null;
    }

    /**
     * Pixel pen for inline window INPUT (after the prompt).
     * Coordinates are relative to .ace-committed (same space as .ace-text-run).
     */
    function inputCaretPos() {
      if (!intuiMode || !currentWindowId) return null;
      const w = windows[currentWindowId];
      if (!w) return null;
      return {
        x: w.penX | 0,
        y: w.penY | 0,
        row: w.cursorRow | 0,
        col: w.cursorCol | 0,
        windowId: currentWindowId,
      };
    }

    /** Current COLOR pens for the live INPUT draft (match PRINT runs). */
    function inputPenColors() {
      if (!intuiMode || !currentWindowId) return null;
      const w = windows[currentWindowId];
      if (!w) return null;
      return {
        fg: penColor(w, w.fgd),
        bg: penColor(w, w.bgd),
      };
    }

    /** Preferred mount node for live INPUT draft inside a window (committed layer). */
    function inputMountEl() {
      if (!intuiMode || !currentWindowId) return null;
      const w = windows[currentWindowId];
      if (!w) return null;
      return w.committedEl || w.contentEl || null;
    }

    function clearOutput() {
      if (output) output.textContent = "";
      write._buf = "";
    }

    function formatValue(v) {
      if (v === undefined || v === null) return "";
      if (typeof v === "number" && isFinite(v)) {
        // AmigaBASIC / ACE PRINT#: leading space (or '-') and trailing space.
        const body = (v >= 0 ? " " : "") + String(v);
        return body + " ";
      }
      return String(v);
    }

    function printParts(parts, after) {
      if (stopped) return;
      const ps = parts || [];
      const seps = after || [];
      let text = "";
      for (let i = 0; i < ps.length; i++) {
        text += formatValue(ps[i]);
        const sep = seps[i];
        if (sep === ",") text += "\t";
      }
      const lastSep = ps.length ? seps[ps.length - 1] : null;
      const newline = ps.length === 0 || (lastSep !== ";" && lastSep !== ",");
      write(text + (newline ? "\n" : ""));
    }

    function print() {
      const parts = [];
      const after = [];
      for (let i = 0; i < arguments.length; i++) {
        parts.push(arguments[i]);
        after.push(i === arguments.length - 1 ? null : ";");
      }
      printParts(parts, after);
    }

    function toNumber(raw) {
      const n = parseFloat(String(raw).trim());
      return isFinite(n) ? n : 0;
    }

    /**
     * ACE INPUT: write prompt (often "? "), wait for one line.
     * Resolves with the raw line (no newline). Auto-feeds options.inputLines when set.
     */
    function input(prompt) {
      const p = prompt == null ? "" : String(prompt);
      write(p);
      if (inputLines && inputLines.length) {
        const line = String(inputLines.shift());
        write(line + "\n");
        return Promise.resolve(line);
      }
      return new Promise(function (resolve, reject) {
        if (stopped) {
          resolve("");
          return;
        }
        pendingInput = {
          resolve: function (line) {
            pendingInput = null;
            if (onInputDone) onInputDone();
            resolve(line);
          },
          reject: reject,
        };
        if (onInputRequest) {
          onInputRequest(p, {
            intuiMode: intuiMode,
            windowId: currentWindowId,
          });
        }
      });
    }

    function provideInput(line) {
      const text = line == null ? "" : String(line);
      write(text + "\n");
      if (pendingInput) pendingInput.resolve(text);
    }

    function timer() {
      return (Date.now() - startMs) / 1000;
    }

    // --- Math builtins (ACE Language Reference) ---
    let rngState = (Date.now() ^ 0x9e3779b9) >>> 0;
    let lastRnd = 0;

    function nextUnitRandom() {
      // xorshift32 → [0, 1)
      let x = rngState || 1;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      rngState = x >>> 0;
      lastRnd = (rngState >>> 0) / 4294967296;
      return lastRnd;
    }

    function randomize(seed) {
      if (seed == null || seed === undefined) {
        rngState = (Date.now() ^ 0x9e3779b9) >>> 0;
        return;
      }
      let s = Number(seed);
      if (!isFinite(s)) s = Date.now();
      // Mix float seeds (e.g. TIMER) into a 32-bit state.
      rngState = (Math.floor(Math.abs(s) * 1000000) ^ 0xA5A5A5A5) >>> 0;
      if (!rngState) rngState = 1;
    }

    function rnd(n) {
      // AmigaBASIC: RND or RND(positive) → next; RND(0) → last; RND(negative) → reseed
      if (arguments.length === 0 || n == null || n === undefined) return nextUnitRandom();
      const v = Number(n);
      if (v < 0) {
        randomize(v);
        return nextUnitRandom();
      }
      if (v === 0) return lastRnd;
      return nextUnitRandom();
    }

    function abs(n) { return Math.abs(Number(n)); }
    function atn(n) { return Math.atan(Number(n)); }
    function cos(n) { return Math.cos(Number(n)); }
    function sin(n) { return Math.sin(Number(n)); }
    function tan(n) { return Math.tan(Number(n)); }
    function exp(n) { return Math.exp(Number(n)); }
    function log(n) { return Math.log(Number(n)); }
    function sqr(n) { return Math.sqrt(Number(n)); }
    function sgn(n) {
      const v = Number(n);
      if (v > 0) return 1;
      if (v < 0) return -1;
      return 0;
    }
    /** INT: greatest integer ≤ n (floor). */
    function int(n) { return Math.floor(Number(n)); }
    /** FIX: truncate toward zero. */
    function fix(n) { return Math.trunc(Number(n)); }
    /** CINT: round; .5 always rounds up (ACE). */
    function cint(n) {
      const v = Number(n);
      const f = v - Math.floor(v);
      if (f === 0.5) return Math.floor(v) + 1;
      return Math.round(v);
    }
    function clng(n) { return cint(n); }

    function ensureScreensHostVisible() {
      if (screensHost) {
        screensHost.hidden = false;
        screensHost.setAttribute("aria-hidden", "false");
      }
      notifyDisplay();
    }

    function hideScreensHostIfEmpty() {
      if (!screensHost) return;
      let any = false;
      for (const id in screens) {
        if (screens[id]) {
          any = true;
          break;
        }
      }
      if (!any) {
        screensHost.hidden = true;
        screensHost.setAttribute("aria-hidden", "true");
        screensHost.innerHTML = "";
      }
      notifyDisplay();
    }

    function makeScreenEl(scr) {
      if (!screensHost) return null;
      const el = document.createElement("div");
      el.className = "ace-screen";
      el.dataset.screenId = String(scr.id);
      el.style.width = scr.w + "px";
      el.style.height = scr.h + "px";
      el.style.background = scr.palette[0] || DEFAULT_PALETTE[0];
      screensHost.appendChild(el);
      return el;
    }

    function initRastPort(win) {
      const contentH = win.borderless ? win.height : Math.max(1, win.height - TITLEBAR_H);
      const contentW = Math.max(1, win.width);
      win.rpW = contentW;
      win.rpH = contentH;
      win.indices = new Uint8ClampedArray(contentW * contentH);
      win._imageData = null;
      win.penX = 0;
      win.penY = 0;
      win.cursorRow = 1;
      win.cursorCol = 1;
      win.linePat = 0xffff;
      win.linePatCnt = 15;
      win.areaPat = [0xffff];
      win.areaPts = [];
      win.lastAreaX = 0;
      win.lastAreaY = 0;
      // Fill with background pen.
      const bg = win.bgd & 255;
      for (let i = 0; i < win.indices.length; i++) win.indices[i] = bg;
      if (win.canvas) {
        win.canvas.width = contentW;
        win.canvas.height = contentH;
        win.ctx = win.canvas.getContext("2d");
        flushRastPort(win);
      }
    }

    function makeWindowEl(win) {
      const parent = win.screenId && screens[win.screenId] && screens[win.screenId].el;
      if (!parent && !screensHost) return null;
      const host = parent || screensHost;
      if (!host) return null;

      const el = document.createElement("div");
      el.className = "ace-window" + (win.borderless ? " borderless" : "") + (win.backdrop ? " backdrop" : "");
      el.dataset.windowId = String(win.id);
      el.style.left = win.x1 + "px";
      el.style.top = win.y1 + "px";
      el.style.width = win.width + "px";
      el.style.height = win.height + "px";

      if (!win.borderless) {
        const bar = document.createElement("div");
        bar.className = "ace-titlebar";

        if (win.type & 8) {
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "ace-gadget ace-close";
          closeBtn.title = "Close";
          closeBtn.setAttribute("aria-label", "Close window");
          closeBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            // Phase 4: close-gadget ≈ ACE -w — close window and stop program.
            closeWindow(win.id);
            stop();
          });
          bar.appendChild(closeBtn);
        }

        const title = document.createElement("span");
        title.className = "ace-title";
        title.textContent = win.title || "";
        bar.appendChild(title);

        if (win.type & 4) {
          const depthBtn = document.createElement("button");
          depthBtn.type = "button";
          depthBtn.className = "ace-gadget ace-depth";
          depthBtn.title = "Depth";
          depthBtn.setAttribute("aria-label", "Depth arrange");
          depthBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (el.parentNode) el.parentNode.appendChild(el);
          });
          bar.appendChild(depthBtn);
        }

        el.appendChild(bar);

        if (win.type & 2) {
          enableDrag(el, bar);
        }
      }

      const body = document.createElement("div");
      body.className = "ace-window-body";

      const canvas = document.createElement("canvas");
      canvas.className = "ace-canvas";
      canvas.setAttribute("aria-hidden", "true");
      win.canvas = canvas;
      body.appendChild(canvas);

      const content = document.createElement("pre");
      content.className = "ace-content";
      const committed = document.createElement("span");
      committed.className = "ace-committed";
      committed.textContent = win.text;
      content.appendChild(committed);
      body.appendChild(content);
      el.appendChild(body);

      win.contentEl = content;
      win.committedEl = committed;
      win.el = el;
      initRastPort(win);
      syncTextColor(win);
      host.appendChild(el);
      return el;
    }

    function enableDrag(winEl, handle) {
      let dragging = false;
      let ox = 0;
      let oy = 0;
      handle.addEventListener("mousedown", function (ev) {
        if (ev.button !== 0) return;
        if (ev.target && ev.target.classList && ev.target.classList.contains("ace-gadget")) return;
        dragging = true;
        ox = ev.clientX - winEl.offsetLeft;
        oy = ev.clientY - winEl.offsetTop;
        ev.preventDefault();
      });
      const onMove = function (ev) {
        if (!dragging) return;
        winEl.style.left = Math.max(0, ev.clientX - ox) + "px";
        winEl.style.top = Math.max(0, ev.clientY - oy) + "px";
      };
      const onUp = function () {
        dragging = false;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      winEl._dragCleanup = function () {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
    }

    function openScreen(id, width, height, depth, mode) {
      const sid = id | 0;
      if (sid < 1 || sid > 9) return;
      if (screens[sid]) closeScreen(sid);
      const scr = {
        id: sid,
        w: width | 0,
        h: height | 0,
        depth: depth | 0,
        mode: mode | 0,
        palette: DEFAULT_PALETTE.slice(),
        el: null,
        backdropId: null,
      };
      screens[sid] = scr;
      currentScreenId = sid;
      ensureScreensHostVisible();
      scr.el = makeScreenEl(scr);

      // ACE: opening a screen also opens a borderless backdrop window for output.
      const backId = 100 + sid; // internal id; not counted as user window 1..9
      openWindow(backId, "", 0, 0, scr.w, scr.h, 32, sid, true);
      scr.backdropId = backId;
      notifyDisplay();
    }

    function closeScreen(id) {
      const sid = id | 0;
      const scr = screens[sid];
      if (!scr) return;
      // Close user windows on this screen first.
      const toClose = [];
      for (const wid in windows) {
        if (windows[wid] && windows[wid].screenId === sid) toClose.push(wid | 0);
      }
      for (let i = 0; i < toClose.length; i++) closeWindow(toClose[i]);
      if (scr.el && scr.el.parentNode) scr.el.parentNode.removeChild(scr.el);
      delete screens[sid];
      if (currentScreenId === sid) currentScreenId = 0;
      hideScreensHostIfEmpty();
      if (!Object.keys(windows).length) intuiMode = false;
      notifyDisplay();
    }

    function openWindow(id, title, x1, y1, x2, y2, type, screenId, backdrop) {
      const wid = id | 0;
      if (windows[wid]) closeWindow(wid);
      let t = type;
      if (t === undefined || t === null || t < 0) t = 31;
      t = t | 0;
      let sid = screenId;
      if (sid === undefined || sid === null || sid < 0) {
        // Omit screen-id → current screen, or open screen 1 (Workbench-style WINDOW alone).
        sid = currentScreenId || 1;
      } else {
        sid = sid | 0;
      }
      const left = x1 | 0;
      const top = y1 | 0;
      const right = x2 | 0;
      const bottom = y2 | 0;
      const win = {
        id: wid,
        title: title == null ? "" : String(title),
        x1: left,
        y1: top,
        x2: right,
        y2: bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        type: t,
        screenId: sid,
        borderless: !!(t & 32) || !!backdrop,
        backdrop: !!backdrop,
        text: "",
        el: null,
        contentEl: null,
        committedEl: null,
        canvas: null,
        ctx: null,
        indices: null,
        rpW: 0,
        rpH: 0,
        penX: 0,
        penY: 0,
        cursorRow: 1,
        cursorCol: 1,
        fgd: 1,
        bgd: 0,
        linePat: 0xffff,
        linePatCnt: 15,
        areaPat: [0xffff],
        areaPts: [],
        lastAreaX: 0,
        lastAreaY: 0,
      };
      if (sid >= 1 && !screens[sid]) {
        // Implicit mini-screen so WINDOW alone still shows chrome.
        openScreen(sid, Math.max(320, right + 8), Math.max(200, bottom + 8), 3, 1);
        // openScreen created a backdrop; keep user window on that screen.
      }
      windows[wid] = win;
      if (!win.backdrop) ensureScreensHostVisible();
      // DOM chrome when a host exists; always init indexed RastPort (headless-safe).
      if (typeof document !== "undefined" && (screensHost || (sid && screens[sid] && screens[sid].el))) {
        makeWindowEl(win);
      } else {
        initRastPort(win);
      }
      if (!win.backdrop) {
        currentWindowId = wid;
        intuiMode = true;
      } else if (!currentWindowId) {
        currentWindowId = wid;
        intuiMode = true;
      }
      wakeSleepers();
      notifyDisplay();
    }

    function closeWindow(id) {
      const wid = id | 0;
      const win = windows[wid];
      if (!win) return;
      if (win._dragCleanup) win._dragCleanup();
      if (win.el && win.el.parentNode) win.el.parentNode.removeChild(win.el);
      delete windows[wid];
      if (currentWindowId === wid) {
        // Highest remaining user window, else backdrop, else shell.
        let next = 0;
        for (const k in windows) {
          const w = windows[k];
          if (!w) continue;
          const kid = k | 0;
          if (kid >= 1 && kid <= 9 && kid > next) next = kid;
        }
        if (!next) {
          for (const k2 in windows) {
            if (windows[k2] && windows[k2].backdrop) {
              next = k2 | 0;
              break;
            }
          }
        }
        currentWindowId = next;
        intuiMode = next !== 0;
      }
      wakeSleepers();
      notifyDisplay();
    }

    function windowOutput(id) {
      const wid = id | 0;
      if (windows[wid]) {
        currentWindowId = wid;
        intuiMode = wid !== 0;
        if (windows[wid].el && windows[wid].el.parentNode) {
          windows[wid].el.parentNode.appendChild(windows[wid].el);
        }
      }
    }

    /** WINDOW(n) info function — subset used by demos. */
    function windowFunc(n) {
      const w = windows[currentWindowId];
      switch (n | 0) {
        case 0:
          return currentWindowId; // selected ≈ current for Phase 4
        case 1:
          return currentWindowId;
        case 2:
          return w ? w.width : 0;
        case 3:
          return w ? w.height : 0;
        case 6:
          return 7; // max colour id stub
        case 10:
          return w ? w.fgd : 1;
        case 11:
          return w ? w.bgd : 0;
        case 12:
          return FONT_W;
        case 13:
          return FONT_H;
        default:
          return 0;
      }
    }

    function screenFunc(n) {
      const scr = screens[currentScreenId];
      switch (n | 0) {
        case 5:
          return FONT_W;
        case 6:
          return FONT_H;
        default:
          return 0;
      }
    }

    function cls() {
      const win = currentWin();
      if (!win) {
        clearOutput();
        return;
      }
      win.text = "";
      if (win.committedEl) {
        // Remove PRINT runs only — keep host INPUT chrome (#live-input / caret /
        // #console-input) if it is currently mounted inside this window.
        const keep = [];
        const kids = win.committedEl.childNodes;
        for (let i = 0; i < kids.length; i++) {
          const n = kids[i];
          if (n && n.nodeType === 1 && n.id &&
              (n.id === "live-input" || n.id === "caret" || n.id === "console-input")) {
            keep.push(n);
          }
        }
        win.committedEl.textContent = "";
        for (let k = 0; k < keep.length; k++) win.committedEl.appendChild(keep[k]);
      } else if (win.contentEl) win.contentEl.textContent = "";
      win.cursorRow = 1;
      win.cursorCol = 1;
      win.penX = 0;
      win.penY = 0;
      if (win.indices) {
        const bg = win.bgd & 255;
        for (let i = 0; i < win.indices.length; i++) win.indices[i] = bg;
        flushRastPort(win);
      }
    }

    function color(fg, bg) {
      const win = currentWin();
      if (!win) return;
      if (fg != null) win.fgd = fg | 0;
      if (bg != null && bg !== undefined) win.bgd = bg | 0;
      syncTextColor(win);
    }

    function palette(id, r, g, b) {
      const sid = currentScreenId;
      const scr = screens[sid];
      // PALETTE can also affect "Workbench" — without a custom screen, no-op for now.
      if (!scr) return;
      const idx = id | 0;
      if (idx < 0) return;
      while (scr.palette.length <= idx) scr.palette.push("#000000");
      scr.palette[idx] = rgbToHex(r, g, b);
      invalidatePaletteLut(scr);
      if (idx === 0 && scr.el) scr.el.style.background = scr.palette[0];
      flushScreenWindows(sid);
      // Refresh text colours that reference palette pens.
      for (const wid in windows) {
        const win = windows[wid];
        if (win && win.screenId === sid) syncTextColor(win);
      }
    }

    function locate(row, col) {
      const win = currentWin();
      if (!win) return;
      const r = Math.max(1, row | 0);
      const c = Math.max(1, col == null ? 1 : col | 0);
      win.cursorRow = r;
      win.cursorCol = c;
      win.penX = (c - 1) * FONT_W;
      win.penY = (r - 1) * FONT_H;
      // Pad text buffer so windowText() reflects LOCATE (display uses absolute runs).
      const lines = win.text.split("\n");
      while (lines.length < r) lines.push("");
      const target = r - 1;
      let line = lines[target] || "";
      if (line.length < c - 1) line += Array(c - 1 - line.length + 1).join(" ");
      else line = line.slice(0, c - 1);
      lines[target] = line;
      // Keep trailing lines intact (LOCATE does not erase).
      win.text = lines.join("\n");
    }

    function line(step, x1, y1, x2, y2, colorId, box) {
      const win = currentWin();
      if (!win || !win.indices) return;
      let ax = Number(x1);
      let ay = Number(y1);
      if (step) {
        ax = win.penX + ax;
        ay = win.penY + ay;
      }
      const cid = colorId == null ? win.fgd : (colorId | 0);
      if (x2 == null || y2 == null) {
        // LINE STEP (x,y) or LINE (x,y) — from last pen to point.
        drawLineIndices(win, win.penX, win.penY, ax, ay, cid);
        win.penX = ax;
        win.penY = ay;
        markDirty(win);
        return;
      }
      let bx = Number(x2);
      let by = Number(y2);
      if (box === "bf") fillRectIndices(win, ax, ay, bx, by, cid);
      else if (box === "b") strokeRectIndices(win, ax, ay, bx, by, cid);
      else drawLineIndices(win, ax, ay, bx, by, cid);
      win.penX = bx;
      win.penY = by;
      markDirty(win);
    }

    function pset(step, x, y, colorId) {
      const win = currentWin();
      if (!win || !win.indices) return;
      let ax = Number(x);
      let ay = Number(y);
      if (step) {
        ax = win.penX + ax;
        ay = win.penY + ay;
      }
      const cid = colorId == null ? win.fgd : (colorId | 0);
      plotIndex(win, ax, ay, cid);
      win.penX = ax;
      win.penY = ay;
      markDirty(win);
    }

    function circle(x, y, radius, colorId, start, end, aspect) {
      const win = currentWin();
      if (!win || !win.indices) return;
      const cx = Number(x);
      const cy = Number(y);
      const rx = Math.abs(Number(radius)) | 0;
      // Browser canvas has square pixels; ACE default aspect 0.44 was for NTSC.
      // Use 1.0 when unspecified so CIRCLE looks round on modern displays.
      const asp = aspect == null ? 1 : Number(aspect);
      const ry = Math.max(0, Math.round(rx * (isFinite(asp) ? asp : 1)));
      const cid = colorId == null ? win.fgd : (colorId | 0);
      drawEllipseIndices(
        win,
        cx | 0,
        cy | 0,
        rx,
        ry,
        cid,
        start == null ? null : Number(start),
        end == null ? null : Number(end)
      );
      win.penX = cx;
      win.penY = cy;
      markDirty(win);
    }

    function point(x, y) {
      const win = currentWin();
      if (!win) return -1;
      return getIndex(win, Number(x), Number(y));
    }

    // --- Turtle graphics (ACE turtle.lib / ACE docs) ---
    // Angle system: 0° = +X (right), 90° = +Y (down), 180° = left, 270° = up.
    // Default / home orientation is 270° (pointing up) — ACE Programmer's Guide.
    // Degrees increase clockwise (TURNRIGHT). Y grows downward on the rastport.
    // Square-pixel displays use xyRatio 1 (Amiga hi-res used ~1.875).
    let tgDegs = 270;
    let tgPen = 0; // 0 = up, 1 = down (demos use PENUP/PENDOWN explicitly)
    let tgInitX = 0;
    let tgInitY = 0;
    const TG_XY_RATIO = 1;

    function normalizeHeading(deg) {
      let d = Math.trunc(Number(deg));
      if (!isFinite(d)) d = 0;
      d = d % 360;
      if (d < 0) d += 360;
      return d;
    }

    function turtleMove(kind, dist) {
      const win = currentWin();
      if (!win || !win.indices) return;
      let distance = Number(dist);
      if (!isFinite(distance)) distance = 0;
      let degs = tgDegs;
      if (String(kind).toUpperCase() === "BACK") {
        degs = normalizeHeading(degs + 180);
      }
      const theta = (degs * Math.PI) / 180;
      const dx = Math.trunc(TG_XY_RATIO * distance * Math.cos(theta));
      const dy = Math.trunc(distance * Math.sin(theta));
      const nx = (win.penX | 0) + dx;
      const ny = (win.penY | 0) + dy;
      if (tgPen === 1) {
        drawLineIndices(win, win.penX, win.penY, nx, ny, win.fgd | 0);
        markDirty(win);
      }
      win.penX = nx;
      win.penY = ny;
    }

    function turtleTurn(kind, deg) {
      const n = Number(deg);
      const k = String(kind).toUpperCase();
      if (k === "TURNLEFT") {
        tgDegs = normalizeHeading(tgDegs - n);
      } else if (k === "TURNRIGHT" || k === "TURN") {
        // TURN: positive = clockwise (same as TURNRIGHT); negative = counter-clockwise.
        tgDegs = normalizeHeading(tgDegs + n);
      } else {
        tgDegs = normalizeHeading(tgDegs + n);
      }
    }

    function turtleSimple(kind) {
      const k = String(kind).toUpperCase();
      if (k === "PENUP") {
        tgPen = 0;
        return;
      }
      if (k === "PENDOWN") {
        tgPen = 1;
        return;
      }
      if (k === "HOME") {
        setxy(tgInitX, tgInitY);
      }
    }

    function setxy(x, y) {
      const win = currentWin();
      if (!win || !win.indices) return;
      const nx = Number(x);
      const ny = Number(y);
      const ax = isFinite(nx) ? Math.trunc(nx) : 0;
      const ay = isFinite(ny) ? Math.trunc(ny) : 0;
      if (tgPen === 1) {
        drawLineIndices(win, win.penX, win.penY, ax, ay, win.fgd | 0);
        markDirty(win);
      }
      win.penX = ax;
      win.penY = ay;
    }

    function setheading(deg) {
      tgDegs = normalizeHeading(deg);
    }

    function heading() {
      return tgDegs;
    }

    function xcor() {
      const win = currentWin();
      return win ? (win.penX | 0) : 0;
    }

    function ycor() {
      const win = currentWin();
      return win ? (win.penY | 0) : 0;
    }

    /** FONT name,size — Topaz webfont deferred; accept and ignore. */
    function font(/* name, size */) {}

    function ucase(s) {
      return String(s == null ? "" : s).toUpperCase();
    }

    /**
     * PATTERN [line-pattern][,area-array] — Amiga SetDrPt / SetAfPt.
     * linePat null → leave line pattern (or restore default if only area given).
     * areaArr null → leave area pattern.
     */
    function pattern(linePat, areaArr) {
      const win = currentWin();
      if (!win) return;
      if (linePat != null) {
        win.linePat = (linePat | 0) & 0xffff;
        win.linePatCnt = 15;
      } else if (areaArr != null) {
        // ACE: omitted line pattern → $FFFF so area pattern works.
        win.linePat = 0xffff;
        win.linePatCnt = 15;
      }
      if (areaArr != null && typeof areaArr.length === "number") {
        const words = [];
        for (let i = 0; i < areaArr.length; i++) {
          if (areaArr[i] == null || areaArr[i] === undefined) continue;
          words.push((areaArr[i] | 0) & 0xffff);
        }
        // Height should be power-of-two for Amiga; use what we have.
        win.areaPat = words.length ? words : [0xffff];
      }
    }

    function patternRestore() {
      const win = currentWin();
      if (!win) return;
      win.linePat = 0xffff;
      win.linePatCnt = 15;
      win.areaPat = [0xffff];
    }

    /** AREA [STEP](x,y) — accumulate polygon vertices (max 20 like ACE). */
    function area(step, x, y) {
      const win = currentWin();
      if (!win) return;
      if (!win.areaPts) win.areaPts = [];
      if (win.areaPts.length >= 20) return;
      let ax = Number(x);
      let ay = Number(y);
      if (step) {
        ax = (win.lastAreaX | 0) + ax;
        ay = (win.lastAreaY | 0) + ay;
      }
      ax = ax | 0;
      ay = ay | 0;
      win.areaPts.push({ x: ax, y: ay });
      win.lastAreaX = ax;
      win.lastAreaY = ay;
    }

    /** Scanline even-odd fill of win.areaPts with current area pattern. */
    function fillPolygonIndices(win, colorId) {
      const pts = win.areaPts;
      if (!pts || pts.length < 2) return;
      const fg = colorId & 255;
      const bg = win.bgd & 255;
      let minY = pts[0].y;
      let maxY = pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].y > maxY) maxY = pts[i].y;
      }
      minY = Math.max(0, minY | 0);
      maxY = Math.min(win.rpH - 1, maxY | 0);
      const n = pts.length;
      for (let y = minY; y <= maxY; y++) {
        const nodes = [];
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = pts[i].y;
          const yj = pts[j].y;
          if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
            const xi = pts[i].x;
            const xj = pts[j].x;
            nodes.push((xi + ((y - yi) / (yj - yi)) * (xj - xi)) | 0);
          }
        }
        nodes.sort(function (a, b) { return a - b; });
        for (let k = 0; k + 1 < nodes.length; k += 2) {
          let x0 = nodes[k];
          let x1 = nodes[k + 1];
          if (x0 > x1) {
            const t = x0;
            x0 = x1;
            x1 = t;
          }
          x0 = Math.max(0, x0);
          x1 = Math.min(win.rpW - 1, x1);
          for (let x = x0; x <= x1; x++) plotPatterned(win, x, y, fg, bg);
        }
      }
    }

    /** AREAFILL [mode] — mode 1 inverts pen vs max colour id. */
    function areafill(mode) {
      const win = currentWin();
      if (!win || !win.indices) return;
      let cid = win.fgd | 0;
      if ((mode | 0) === 1) {
        const maxId = windowFunc(6) | 0;
        cid = maxId - cid;
      }
      fillPolygonIndices(win, cid);
      win.areaPts = [];
      markDirty(win);
    }

    /**
     * PAINT (x,y)[,paintcolor[,bordercolor]] — Flood fill until border.
     * Default paint colour = foreground; default border = paint colour.
     */
    function paint(x, y, paintColor, borderColor) {
      const win = currentWin();
      if (!win || !win.indices) return;
      const sx = Number(x) | 0;
      const sy = Number(y) | 0;
      let paintId = paintColor == null ? (win.fgd | 0) : (paintColor | 0);
      let borderId = borderColor == null ? paintId : (borderColor | 0);
      const bg = win.bgd & 255;
      if (sx < 0 || sy < 0 || sx >= win.rpW || sy >= win.rpH) return;
      // Already on border — nothing to fill.
      if (getIndex(win, sx, sy) === borderId) return;
      const stack = [sx, sy];
      const visited = new Uint8Array(win.rpW * win.rpH);
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
        if (cx < 0 || cy < 0 || cx >= win.rpW || cy >= win.rpH) continue;
        const idx = cy * win.rpW + cx;
        if (visited[idx]) continue;
        if (getIndex(win, cx, cy) === borderId) continue;
        visited[idx] = 1;
        plotPatterned(win, cx, cy, paintId, bg);
        stack.push(cx + 1, cy);
        stack.push(cx - 1, cy);
        stack.push(cx, cy + 1);
        stack.push(cx, cy - 1);
      }
      markDirty(win);
    }

    // --- Phase 6: Paula-ish SOUND / WAVE via Web Audio ---
    // ACE sine table is 32 bytes; period → Hz: 3579546 / (period * length)
    const PAULA_CLOCK = 3579546;
    const SINE_LEN = 32;
    let audioCtx = null;
    const voiceWave = [null, null, null, null]; // AudioBuffer or 'sin'
    const soundLog = []; // test/observability: {period,duration,volume,voice,freq}

    function ensureAudio() {
      if (audioCtx) return audioCtx;
      const AC = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
        (typeof globalThis !== "undefined" && globalThis.AudioContext);
      if (!AC) return null;
      audioCtx = new AC();
      return audioCtx;
    }

    function makeSineBuffer(ctx) {
      const buf = ctx.createBuffer(1, SINE_LEN, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < SINE_LEN; i++) {
        data[i] = Math.sin((i / SINE_LEN) * Math.PI * 2);
      }
      return buf;
    }

    function waveSin(voice) {
      const v = voice == null ? 0 : (voice | 0);
      if (v < 0 || v > 3) return;
      voiceWave[v] = "sin";
    }

    function waveMem(voice, addr, count) {
      // ALLOC/POKE waveforms deferred; remember intent for diagnostics.
      const v = voice == null ? 0 : (voice | 0);
      if (v < 0 || v > 3) return;
      voiceWave[v] = { mode: "mem", addr: addr, count: count | 0 };
    }

    function periodToHz(period, waveLen) {
      let p = Number(period);
      if (!isFinite(p) || p < 124) p = 124;
      if (p > 32767) p = 32767;
      const len = waveLen || SINE_LEN;
      return PAULA_CLOCK / (p * len);
    }

    function durationToSeconds(duration) {
      const d = Number(duration);
      if (!isFinite(d) || d <= 0) return 0;
      return d / 18.2;
    }

    function voicePan(voice) {
      // 0 & 3 left, 1 & 2 right (ACE Programmer's Guide)
      const v = voice | 0;
      if (v === 0 || v === 3) return -1;
      if (v === 1 || v === 2) return 1;
      return 0;
    }

    /**
     * SOUND period,duration[,volume][,voice] — await until tone ends.
     * Volume 0..64 (default 64). Blocks the BASIC program like a long note.
     */
    function sound(period, duration, volume, voice) {
      if (stopped) return Promise.resolve();
      const v = voice == null || voice === undefined ? 0 : (voice | 0);
      let vol = volume == null || volume === undefined ? 64 : Number(volume);
      if (!isFinite(vol)) vol = 64;
      if (vol < 0) vol = 0;
      if (vol > 64) vol = 64;
      const secs = durationToSeconds(duration);
      const freq = periodToHz(period, SINE_LEN);
      soundLog.push({
        period: Number(period),
        duration: Number(duration),
        volume: vol,
        voice: v,
        freq: freq,
        seconds: secs,
      });

      const ctx = ensureAudio();
      if (!ctx || secs <= 0) {
        // Headless / silent: still yield so busy-wait programs don't freeze hard.
        if (secs <= 0) return Promise.resolve();
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve();
          }, Math.min(secs * 1000, 50));
        });
      }

      return ctx.resume().then(function () {
        if (stopped) return;
        const wave = voiceWave[v] || "sin";
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panNode = (ctx.createStereoPanner && ctx.createStereoPanner()) || null;
        // Default / WAVE SIN → sine oscillator at computed Hz (matches 32-byte table).
        if (wave === "sin" || !wave || wave.mode === "mem") {
          // mem path without ALLOC: fall back to sine so SOUND still audibly works
          osc.type = "sine";
          osc.frequency.value = freq;
        }
        const peak = (vol / 64) * 0.35;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.01);
        gain.gain.setValueAtTime(peak, now + Math.max(0.02, secs - 0.03));
        gain.gain.linearRampToValueAtTime(0, now + secs);
        osc.connect(gain);
        if (panNode) {
          panNode.pan.value = voicePan(v);
          gain.connect(panNode);
          panNode.connect(ctx.destination);
        } else {
          gain.connect(ctx.destination);
        }
        osc.start(now);
        osc.stop(now + secs + 0.02);
        return new Promise(function (resolve) {
          const ms = Math.max(0, secs * 1000);
          setTimeout(function () {
            try { osc.disconnect(); } catch (e) { /* ignore */ }
            resolve();
          }, ms);
        });
      });
    }

    function beep() {
      // Brief pulse ≈ SOUND 300, 2 (≈0.11s) at full volume on voice 0.
      return sound(300, 2, 64, 0);
    }

    /** SLEEP — wake on IntuiTick (~0.1s), key, close, or stop. */
    function sleep() {
      flushAllDirty();
      if (stopped) return Promise.resolve();
      return new Promise(function (resolve) {
        let done = false;
        function finish() {
          if (done) return;
          done = true;
          const i = sleepWaiters.indexOf(finish);
          if (i >= 0) sleepWaiters.splice(i, 1);
          resolve();
        }
        sleepWaiters.push(finish);
        setTimeout(finish, 100);
      });
    }

    /** SLEEP FOR n — wait about n seconds (yields to the event loop). */
    function sleepFor(seconds) {
      flushAllDirty();
      if (stopped) return Promise.resolve();
      const s = Number(seconds);
      const ms = (!isFinite(s) || s <= 0) ? 100 : s * 1000;
      return new Promise(function (resolve) {
        let done = false;
        function finish() {
          if (done) return;
          done = true;
          const i = sleepWaiters.indexOf(finish);
          if (i >= 0) sleepWaiters.splice(i, 1);
          resolve();
        }
        sleepWaiters.push(finish);
        setTimeout(finish, ms);
      });
    }

    function inkey() {
      if (keyQueue.length) return keyQueue.shift();
      return "";
    }

    function pushKey(ch) {
      if (ch == null || ch === "") return;
      keyQueue.push(String(ch).charAt(0));
      wakeSleepers();
    }

    function windowText(id) {
      const w = windows[id | 0];
      return w ? w.text : "";
    }

    /** Test helper: raw color index at (x,y) in window id (default current). */
    function windowPixel(id, x, y) {
      const w = windows[id == null ? currentWindowId : (id | 0)];
      if (!w) return -1;
      return getIndex(w, x, y);
    }

    function stop() {
      stopped = true;
      if (pendingInput) {
        const p = pendingInput;
        pendingInput = null;
        if (onInputDone) onInputDone();
        p.resolve("");
      }
      wakeSleepers();
    }

    function destroyAllWindowsAndScreens() {
      const wids = Object.keys(windows);
      for (let i = 0; i < wids.length; i++) {
        const win = windows[wids[i]];
        if (win && win._dragCleanup) win._dragCleanup();
        if (win && win.el && win.el.parentNode) win.el.parentNode.removeChild(win.el);
      }
      for (const k in windows) delete windows[k];
      const sids = Object.keys(screens);
      for (let j = 0; j < sids.length; j++) {
        const scr = screens[sids[j]];
        if (scr && scr.el && scr.el.parentNode) scr.el.parentNode.removeChild(scr.el);
        delete screens[sids[j]];
      }
      if (screensHost) {
        screensHost.innerHTML = "";
        screensHost.hidden = true;
        screensHost.setAttribute("aria-hidden", "true");
      }
      currentScreenId = 0;
      currentWindowId = 0;
      intuiMode = false;
    }

    function reset() {
      stopped = false;
      pendingInput = null;
      keyQueue = [];
      sleepWaiters = [];
      tgDegs = 270;
      tgPen = 0;
      tgInitX = 0;
      tgInitY = 0;
      if (options && options.inputLines) inputLines = options.inputLines.slice();
      destroyAllWindowsAndScreens();
      clearOutput();
      notifyDisplay();
    }

    return {
      print: print,
      printParts: printParts,
      formatValue: formatValue,
      toNumber: toNumber,
      input: input,
      provideInput: provideInput,
      timer: timer,
      clear: clearOutput,
      stop: stop,
      reset: reset,
      openScreen: openScreen,
      closeScreen: closeScreen,
      openWindow: openWindow,
      closeWindow: closeWindow,
      windowOutput: windowOutput,
      windowFunc: windowFunc,
      screenFunc: screenFunc,
      cls: cls,
      color: color,
      palette: palette,
      locate: locate,
      line: line,
      pset: pset,
      circle: circle,
      point: point,
      turtleMove: turtleMove,
      turtleTurn: turtleTurn,
      turtleSimple: turtleSimple,
      setxy: setxy,
      setheading: setheading,
      heading: heading,
      xcor: xcor,
      ycor: ycor,
      font: font,
      paint: paint,
      area: area,
      areafill: areafill,
      pattern: pattern,
      patternRestore: patternRestore,
      sleep: sleep,
      sleepFor: sleepFor,
      sound: sound,
      beep: beep,
      waveSin: waveSin,
      waveMem: waveMem,
      soundLog: soundLog,
      periodToHz: periodToHz,
      inkey: inkey,
      pushKey: pushKey,
      windowText: windowText,
      windowPixel: windowPixel,
      activeTextSurface: activeTextSurface,
      inputCaretPos: inputCaretPos,
      inputPenColors: inputPenColors,
      inputMountEl: inputMountEl,
      randomize: randomize,
      rnd: rnd,
      abs: abs,
      atn: atn,
      cos: cos,
      sin: sin,
      tan: tan,
      exp: exp,
      log: log,
      sqr: sqr,
      sgn: sgn,
      int: int,
      fix: fix,
      cint: cint,
      clng: clng,
      ucase: ucase,
      get stopped() {
        return stopped;
      },
      get awaitingInput() {
        return !!pendingInput;
      },
      get intuiMode() {
        return intuiMode;
      },
      get currentWindowId() {
        return currentWindowId;
      },
    };
  }

  global.ACE = global.ACE || {};
  global.ACE.createRuntime = createRuntime;
})(typeof window !== "undefined" ? window : globalThis);
