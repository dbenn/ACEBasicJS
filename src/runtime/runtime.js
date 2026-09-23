/* ACEBasicJS runtime — console I/O, TIMER, INPUT, SCREEN/WINDOW (Phase 4). */
(function (global) {
  "use strict";

  /** Workbench 2.0-ish default palette (RGB 0..1 later via PALETTE). */
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
    const screens = Object.create(null); // id -> { id, w, h, depth, mode, palette, el, backdropId }
    const windows = Object.create(null); // id -> window record

    function notifyDisplay() {
      if (onDisplayChange) onDisplayChange({ intuiMode: intuiMode, screens: screens, windows: windows });
    }

    function wakeSleepers() {
      const waiters = sleepWaiters;
      sleepWaiters = [];
      for (let i = 0; i < waiters.length; i++) waiters[i]();
    }

    function write(text) {
      if (stopped) return;
      const w = currentWindowId && windows[currentWindowId];
      if (intuiMode && w) {
        w.text += text;
        if (w.contentEl) w.contentEl.textContent = w.text;
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
        if (onInputRequest) onInputRequest(p);
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

      const content = document.createElement("pre");
      content.className = "ace-content";
      content.textContent = win.text;
      el.appendChild(content);
      win.contentEl = content;
      win.el = el;
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
        sid = currentScreenId || 0;
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
        fgd: 1,
        bgd: 0,
      };
      if (sid >= 1 && !screens[sid]) {
        // Implicit mini-screen so WINDOW alone still shows chrome.
        openScreen(sid, Math.max(320, right + 8), Math.max(200, bottom + 8), 3, 1);
        // openScreen created a backdrop; keep user window on that screen.
      }
      windows[wid] = win;
      if (!win.backdrop) ensureScreensHostVisible();
      makeWindowEl(win);
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
          return 8; // font width stub (Topaz 8)
        case 13:
          return 8;
        default:
          return 0;
      }
    }

    function screenFunc(n) {
      const scr = screens[currentScreenId];
      switch (n | 0) {
        case 5:
          return 8;
        case 6:
          return 8;
        default:
          return 0;
      }
    }

    /** SLEEP — wake on IntuiTick (~0.1s), key, close, or stop. */
    function sleep() {
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
      sleep: sleep,
      inkey: inkey,
      pushKey: pushKey,
      windowText: windowText,
      get stopped() {
        return stopped;
      },
      get awaitingInput() {
        return !!pendingInput;
      },
      get intuiMode() {
        return intuiMode;
      },
    };
  }

  global.ACE = global.ACE || {};
  global.ACE.createRuntime = createRuntime;
})(typeof window !== "undefined" ? window : globalThis);
