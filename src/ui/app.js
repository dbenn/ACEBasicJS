/* ACEBasicJS host UI — picker + always-visible editable source + unified I/O. */
(function () {
  "use strict";

  const picker = document.getElementById("program-picker");
  const source = document.getElementById("source");
  const consoleEl = document.getElementById("console");
  const output = document.getElementById("output");
  const screensHost = document.getElementById("screens");
  const mainEl = document.querySelector(".main");
  const splitter = document.getElementById("splitter");
  const outputPanel = document.querySelector(".output-panel");
  const liveInput = document.getElementById("live-input");
  const caret = document.getElementById("caret");
  const consoleInput = document.getElementById("console-input");
  const inkeyBar = document.getElementById("inkey-bar");
  const inkeyCapture = document.getElementById("inkey-capture");
  const status = document.getElementById("status");
  const runBtn = document.getElementById("run");
  const stopBtn = document.getElementById("stop");
  const SPLIT_STORAGE_KEY = "acebasicjs-split-editor";

  let runToken = 0;
  let awaitingInput = false;
  let inkeyArmed = false;
  /** @type {HTMLElement|null} surface holding live-input + caret (console or window) */
  let inputMount = consoleEl;

  function clearInlineDraftStyles() {
    liveInput.classList.remove("ace-inline-draft");
    caret.classList.remove("ace-inline-draft");
    liveInput.style.left = "";
    liveInput.style.top = "";
    liveInput.style.color = "";
    liveInput.style.backgroundColor = "";
    caret.style.left = "";
    caret.style.top = "";
    caret.style.background = "";
  }

  function applyInlineDraftAtPen() {
    const pos = runtime.inputCaretPos && runtime.inputCaretPos();
    if (!pos) {
      clearInlineDraftStyles();
      return;
    }
    liveInput.classList.add("ace-inline-draft");
    caret.classList.add("ace-inline-draft");
    liveInput.style.left = pos.x + "px";
    liveInput.style.top = pos.y + "px";
    // Match window COLOR so the draft is never white-on-white / invisible.
    const pens = runtime.inputPenColors && runtime.inputPenColors();
    if (pens) {
      liveInput.style.color = pens.fg;
      liveInput.style.backgroundColor = pens.bg;
      caret.style.background = pens.fg;
    } else {
      liveInput.style.color = "";
      liveInput.style.backgroundColor = "";
      caret.style.background = "";
    }
    // Caret sits after the typed draft; update on each keystroke via syncLiveInput.
    positionCaretAfterDraft(pos);
  }

  function positionCaretAfterDraft(pos) {
    const p = pos || (runtime.inputCaretPos && runtime.inputCaretPos());
    if (!p || !caret.classList.contains("ace-inline-draft")) return;
    // Match .ace-text-run glyph width (8px) used for window PRINT.
    const draftPx = (consoleInput.value || "").length * 8;
    caret.style.left = p.x + draftPx + "px";
    caret.style.top = p.y + "px";
  }

  function syncLiveInput() {
    liveInput.textContent = consoleInput.value;
    positionCaretAfterDraft();
  }

  function scrollMountToEnd() {
    if (!inputMount) return;
    // For absolute inline drafts, scroll so the pen row is visible.
    const scroller = (inputMount.classList && inputMount.classList.contains("ace-content"))
      ? inputMount
      : (inputMount.closest && inputMount.closest(".ace-content")) || consoleEl;
    if (!scroller) return;
    const pos = runtime.inputCaretPos && runtime.inputCaretPos();
    if (pos && scroller.classList && scroller.classList.contains("ace-content")) {
      const pad = 16;
      scroller.scrollTop = Math.max(0, pos.y - pad);
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }

  /** Mount live draft + caret + mirror field on the active text surface. */
  function mountInputOnSurface(surface) {
    clearInlineDraftStyles();
    // Window: mount inside .ace-committed so pen coords match coloured PRINT runs.
    // Console: mount on the console shell (inline after #output).
    const useWindow = !!(surface && surface !== consoleEl);
    let mount = consoleEl;
    if (useWindow) {
      const committed = runtime.inputMountEl && runtime.inputMountEl();
      mount = committed || surface;
    }
    inputMount = mount;
    mount.appendChild(liveInput);
    mount.appendChild(caret);
    mount.appendChild(consoleInput);

    if (screensHost) {
      const prev = screensHost.querySelectorAll(".ace-content.awaiting-input");
      for (let i = 0; i < prev.length; i++) prev[i].classList.remove("awaiting-input");
    }
    consoleEl.classList.remove("awaiting-input");

    if (useWindow) {
      const contentEl = (mount.classList && mount.classList.contains("ace-content"))
        ? mount
        : (mount.closest && mount.closest(".ace-content"));
      if (contentEl) contentEl.classList.toggle("awaiting-input", awaitingInput);
      if (awaitingInput) applyInlineDraftAtPen();
    } else {
      consoleEl.classList.toggle("awaiting-input", awaitingInput);
    }
  }

  function focusConsoleInput() {
    if (!awaitingInput || consoleInput.disabled) return;
    try {
      consoleInput.focus({ preventScroll: true });
    } catch (err) {
      consoleInput.focus();
    }
  }

  /**
   * Desktop fallback: focus Display/console so physical keyboards hit document keydown.
   * iOS/Android need armInkeyCapture() instead (soft keyboard requires a text field).
   */
  function focusProgramSurface() {
    const el = (screensHost && !screensHost.hidden) ? screensHost : consoleEl;
    if (!el || typeof el.focus !== "function") return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  function isCoarsePointer() {
    try {
      return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    } catch (err) {
      return false;
    }
  }

  /** Push characters from the INKEY capture field into the runtime key queue. */
  function flushInkeyCapture() {
    if (!inkeyCapture || !runtime) return;
    const v = String(inkeyCapture.value || "");
    if (!v) return;
    inkeyCapture.value = "";
    for (let i = 0; i < v.length; i++) {
      runtime.pushKey(v.charAt(i));
    }
  }

  /**
   * Show a real <input> for INKEY$/SLEEP wait loops. Soft keyboards (iOS especially)
   * only open for text fields; many mobile browsers deliver keys via `input`, not keydown.
   * Call synchronously from a tap/Enter handler when possible so iOS allows focus.
   */
  function armInkeyCapture(opts) {
    const doFocus = !opts || opts.focus !== false;
    if (!inkeyBar || !inkeyCapture) {
      if (doFocus) focusProgramSurface();
      return;
    }
    inkeyArmed = true;
    inkeyBar.hidden = false;
    inkeyCapture.disabled = false;
    inkeyCapture.value = "";
    if (doFocus) {
      try {
        inkeyCapture.focus({ preventScroll: true });
      } catch (err) {
        inkeyCapture.focus();
      }
    }
    if (runBtn.disabled) {
      setStatus(
        isCoarsePointer()
          ? "Tap Keys, then press q to quit."
          : "Running… (press q to quit, or use Keys)",
        "info"
      );
    }
  }

  function disarmInkeyCapture() {
    inkeyArmed = false;
    if (inkeyCapture) {
      inkeyCapture.value = "";
      if (document.activeElement === inkeyCapture && typeof inkeyCapture.blur === "function") {
        inkeyCapture.blur();
      }
    }
    if (inkeyBar) inkeyBar.hidden = true;
  }

  function setInputEnabled(on) {
    awaitingInput = on;
    consoleInput.disabled = !on;
    caret.hidden = !on;
    if (on) {
      disarmInkeyCapture();
      const surface = runtime.activeTextSurface();
      mountInputOnSurface(surface);
      if (outputPanel) {
        outputPanel.classList.toggle("input-in-window", !!surface);
      }
      consoleInput.value = "";
      syncLiveInput();
      scrollMountToEnd();
      // Leave the source editor so the next keystrokes feed INPUT, not the textarea.
      if (source && typeof source.blur === "function" && document.activeElement === source) {
        source.blur();
      }
      // Defer past the Run-button click so focus is not stolen back by the button.
      focusConsoleInput();
      setTimeout(focusConsoleInput, 0);
      setStatus(
        surface
          ? "Type in the window — press Enter to submit."
          : "Type after the prompt — press Enter to submit.",
        "info"
      );
    } else {
      if (inputMount) inputMount.classList.remove("awaiting-input");
      if (outputPanel) outputPanel.classList.remove("input-in-window");
      // Return draft chrome to the CLI console between runs / prompts.
      mountInputOnSurface(consoleEl);
      consoleInput.value = "";
      syncLiveInput();
      if (runBtn.disabled) {
        // Arm INKEY capture in this turn (same gesture as Enter on INPUT) so iOS
        // will open the soft keyboard for q-to-quit / any-key waits.
        if (consoleInput && typeof consoleInput.blur === "function") consoleInput.blur();
        armInkeyCapture({ focus: true });
      }
    }
  }

  const runtime = ACE.createRuntime({
    output: output,
    screensHost: screensHost,
    onInputRequest: function () {
      setInputEnabled(true);
    },
    onInputDone: function () {
      setInputEnabled(false);
    },
    onDisplayChange: function (info) {
      if (outputPanel) {
        outputPanel.classList.toggle("intui-active", !!(info && info.intuiMode));
      }
      // If a window opens while awaiting INPUT, remount onto that surface.
      if (awaitingInput) {
        const surface = runtime.activeTextSurface();
        mountInputOnSurface(surface);
        if (outputPanel) outputPanel.classList.toggle("input-in-window", !!surface);
        syncLiveInput();
        focusConsoleInput();
      } else if (runBtn.disabled && info && info.intuiMode) {
        // Show Keys bar (no forced focus — iOS only opens the keyboard on a tap).
        armInkeyCapture({ focus: false });
      }
    },
  });

  /**
   * While INPUT is awaiting, route typing into the draft even if focus stuck on
   * Run / Stop / the window chrome (common after clicking Run). Skip the source
   * editor and picker so editing ACE source still works.
   */
  function handleAwaitingInputKey(ev) {
    if (!awaitingInput || consoleInput.disabled) return false;
    if (ev.target === source || ev.target === picker) return false;
    // Native handling when the mirror field already has focus.
    if (ev.target === consoleInput) return false;

    if (ev.key === "Enter") {
      ev.preventDefault();
      submitConsoleInput();
      return true;
    }
    if (ev.key === "Backspace") {
      ev.preventDefault();
      consoleInput.value = String(consoleInput.value || "").slice(0, -1);
      syncLiveInput();
      scrollMountToEnd();
      return true;
    }
    if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      ev.preventDefault();
      consoleInput.value = String(consoleInput.value || "") + ev.key;
      syncLiveInput();
      scrollMountToEnd();
      return true;
    }
    return false;
  }

  // Feed INKEY$ / SLEEP from a physical keyboard while a program runs.
  // Soft keyboards use #inkey-capture `input` instead (see armInkeyCapture).
  // Skip source/picker (editing). Skip #inkey-capture (its own handlers).
  // Do not skip disabled #console-input — leftover focus used to swallow quit keys.
  document.addEventListener("keydown", function (ev) {
    if (handleAwaitingInputKey(ev)) return;
    if (awaitingInput) return;
    if (ev.target === source || ev.target === picker || ev.target === inkeyCapture) return;
    if (ev.key && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      runtime.pushKey(ev.key);
    }
  });

  let manifest = [];

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.dataset.kind = kind || "info";
  }

  function setRunning(isRunning) {
    runBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;
    if (!isRunning) {
      setInputEnabled(false);
      disarmInkeyCapture();
    }
  }

  /** Folder order: ACEBasicJS first (host demos), then ACE prgs folders A–Z. */
  function folderSortKey(name) {
    if (name === "ACEBasicJS") return "0";
    if (name === "prgs") return "1";
    return "2" + String(name || "").toLowerCase();
  }

  function fillPicker() {
    picker.innerHTML = "";
    const byFolder = Object.create(null);
    const folderOrder = [];
    manifest.forEach(function (entry) {
      const folder = entry.folder || "prgs";
      if (!byFolder[folder]) {
        byFolder[folder] = [];
        folderOrder.push(folder);
      }
      byFolder[folder].push(entry);
    });
    folderOrder.sort(function (a, b) {
      const ka = folderSortKey(a);
      const kb = folderSortKey(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return 0;
    });
    folderOrder.forEach(function (folder) {
      const group = document.createElement("optgroup");
      group.label = folder;
      byFolder[folder]
        .slice()
        .sort(function (a, b) {
          return String(a.title || a.id).localeCompare(String(b.title || b.id));
        })
        .forEach(function (entry) {
          const opt = document.createElement("option");
          opt.value = entry.id;
          opt.textContent = entry.title || entry.id;
          group.appendChild(opt);
        });
      picker.appendChild(group);
    });
  }

  async function loadManifest() {
    const res = await fetch("examples/manifest.json");
    if (!res.ok) throw new Error("Could not load examples/manifest.json");
    manifest = await res.json();
    fillPicker();
  }

  async function loadProgram(id) {
    const entry = manifest.find(function (m) {
      return m.id === id;
    });
    if (!entry) return;
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error("Could not load " + entry.path);
    source.value = await res.text();
    setStatus("Loaded " + entry.path + (entry.notes ? " — " + entry.notes : ""), "info");
  }

  async function runCurrent() {
    const token = ++runToken;
    runtime.reset();
    setRunning(true);
    setStatus("Running…", "info");
    try {
      const compiled = ACE.compile(source.value);
      if (!compiled.ok) {
        compiled.diagnostics.forEach(function (d) {
          runtime.print("Line " + (d.line || "?") + ": " + d.message);
          if (d.text) runtime.print("  " + d.text);
        });
        setStatus("Compile failed.", "error");
        return;
      }
      await ACE.run(compiled, runtime);
      if (token !== runToken) return;
      setStatus(runtime.stopped ? "Stopped." : "Ran successfully.", "info");
    } catch (err) {
      if (token !== runToken) return;
      runtime.print(String(err && err.message ? err.message : err));
      setStatus("Run failed.", "error");
    } finally {
      if (token === runToken) setRunning(false);
    }
  }

  function stopCurrent() {
    runToken++;
    runtime.stop();
    setRunning(false);
    setStatus("Stopped.", "info");
  }

  function submitConsoleInput() {
    if (!awaitingInput || consoleInput.disabled) return;
    const line = consoleInput.value;
    consoleInput.value = "";
    syncLiveInput();
    runtime.provideInput(line);
    scrollMountToEnd();
    // provideInput → onInputDone → setInputEnabled(false) → armInkeyCapture.
    // Re-focus capture here too so the Enter gesture still counts on iOS.
    if (runBtn.disabled && !awaitingInput) {
      armInkeyCapture({ focus: true });
    }
  }

  function focusInputIfAwaiting(ev) {
    if (!awaitingInput) return;
    if (ev.target === consoleInput) return;
    // Don't steal clicks from window gadgets (close / depth).
    if (ev.target && ev.target.classList && ev.target.classList.contains("ace-gadget")) return;
    ev.preventDefault();
    focusConsoleInput();
  }

  picker.addEventListener("change", function () {
    loadProgram(picker.value).catch(function (err) {
      setStatus(String(err.message || err), "error");
    });
  });

  runBtn.addEventListener("click", function () {
    runCurrent();
  });
  stopBtn.addEventListener("click", stopCurrent);

  consoleEl.addEventListener("mousedown", focusInputIfAwaiting);
  if (screensHost) {
    // pointerdown (not only mouse) so iOS taps arm the Keys field / open keyboard.
    screensHost.addEventListener("pointerdown", function (ev) {
      if (awaitingInput) {
        focusInputIfAwaiting(ev);
        return;
      }
      if (ev.target && ev.target.classList && ev.target.classList.contains("ace-gadget")) return;
      if (runBtn.disabled) {
        armInkeyCapture({ focus: true });
      }
    });
  }

  consoleInput.addEventListener("input", function () {
    syncLiveInput();
    scrollMountToEnd();
  });

  consoleInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitConsoleInput();
    }
  });

  if (inkeyCapture) {
    // Soft keyboards (and desktop when Keys is focused): chars arrive on `input`.
    // Prefer `input` only — pairing with keydown pushKey double-fires on some browsers.
    inkeyCapture.addEventListener("input", function () {
      if (!inkeyArmed || awaitingInput) return;
      flushInkeyCapture();
    });
    inkeyCapture.addEventListener("keydown", function (ev) {
      if (!inkeyArmed || awaitingInput) return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        flushInkeyCapture();
      }
    });
  }
  if (inkeyBar) {
    inkeyBar.addEventListener("pointerdown", function () {
      if (runBtn.disabled && !awaitingInput) armInkeyCapture({ focus: true });
    });
  }

  // Keep typed characters visible; scroll as PRINT / prompt text grows.
  const mo = typeof MutationObserver !== "undefined"
    ? new MutationObserver(scrollMountToEnd)
    : null;
  if (mo) mo.observe(output, { childList: true, characterData: true, subtree: true });

  function isWideSplit() {
    return window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
  }

  function clampSplitPercent(pct) {
    const n = Number(pct);
    if (!isFinite(n)) return 48;
    return Math.min(80, Math.max(20, n));
  }

  function applySplitPercent(pct) {
    if (!mainEl) return;
    const value = clampSplitPercent(pct);
    mainEl.style.setProperty("--split-editor", value + "%");
    if (splitter) {
      splitter.setAttribute("aria-valuenow", String(Math.round(value)));
      splitter.setAttribute("aria-valuemin", "20");
      splitter.setAttribute("aria-valuemax", "80");
      splitter.setAttribute(
        "aria-orientation",
        isWideSplit() ? "vertical" : "horizontal"
      );
    }
  }

  function persistSplitPercent(pct) {
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(clampSplitPercent(pct)));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function loadSplitPercent() {
    try {
      const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
      if (raw != null && raw !== "") return clampSplitPercent(raw);
    } catch (e) {
      /* ignore */
    }
    return 48;
  }

  function bindSplitter() {
    if (!mainEl || !splitter) return;
    applySplitPercent(loadSplitPercent());

    let dragging = false;

    function splitFromPointer(clientX, clientY) {
      const rect = mainEl.getBoundingClientRect();
      if (isWideSplit()) {
        if (rect.width <= 0) return;
        return ((clientX - rect.left) / rect.width) * 100;
      }
      if (rect.height <= 0) return;
      return ((clientY - rect.top) / rect.height) * 100;
    }

    function onPointerMove(ev) {
      if (!dragging) return;
      const pct = splitFromPointer(ev.clientX, ev.clientY);
      if (pct == null) return;
      applySplitPercent(pct);
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("split-dragging");
      const raw = getComputedStyle(mainEl).getPropertyValue("--split-editor");
      persistSplitPercent(parseFloat(raw));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    }

    splitter.addEventListener("pointerdown", function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      dragging = true;
      document.body.classList.add("split-dragging");
      try {
        splitter.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* ignore */
      }
      const pct = splitFromPointer(ev.clientX, ev.clientY);
      if (pct != null) applySplitPercent(pct);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      ev.preventDefault();
    });

    splitter.addEventListener("keydown", function (ev) {
      const step = ev.shiftKey ? 5 : 2;
      let delta = 0;
      if (isWideSplit()) {
        if (ev.key === "ArrowLeft") delta = -step;
        else if (ev.key === "ArrowRight") delta = step;
      } else {
        if (ev.key === "ArrowUp") delta = -step;
        else if (ev.key === "ArrowDown") delta = step;
      }
      if (!delta) return;
      ev.preventDefault();
      const raw = getComputedStyle(mainEl).getPropertyValue("--split-editor");
      const next = clampSplitPercent(parseFloat(raw) + delta);
      applySplitPercent(next);
      persistSplitPercent(next);
    });

    window.addEventListener("resize", function () {
      applySplitPercent(
        parseFloat(getComputedStyle(mainEl).getPropertyValue("--split-editor"))
      );
    });
  }

  bindSplitter();

  loadManifest()
    .then(function () {
      if (manifest.length) {
        picker.value = manifest[0].id;
        return loadProgram(manifest[0].id);
      }
    })
    .catch(function (err) {
      setStatus(String(err.message || err), "error");
    });
})();
