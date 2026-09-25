/* ACEBasicJS host UI — picker + always-visible editable source + unified I/O. */
(function () {
  "use strict";

  const picker = document.getElementById("program-picker");
  const source = document.getElementById("source");
  const consoleEl = document.getElementById("console");
  const output = document.getElementById("output");
  const screensHost = document.getElementById("screens");
  const outputPanel = document.querySelector(".output-panel");
  const liveInput = document.getElementById("live-input");
  const caret = document.getElementById("caret");
  const consoleInput = document.getElementById("console-input");
  const status = document.getElementById("status");
  const runBtn = document.getElementById("run");
  const stopBtn = document.getElementById("stop");

  let runToken = 0;
  let awaitingInput = false;
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

  function setInputEnabled(on) {
    awaitingInput = on;
    consoleInput.disabled = !on;
    caret.hidden = !on;
    if (on) {
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
      if (runBtn.disabled) setStatus("Running…", "info");
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

  // Feed INKEY$ / SLEEP from keyboard when Display or screens have focus.
  // Also keep windowed INPUT draft in sync when focus is not on #console-input.
  document.addEventListener("keydown", function (ev) {
    if (handleAwaitingInputKey(ev)) return;
    if (awaitingInput) return;
    if (ev.target === source || ev.target === picker || ev.target === consoleInput) return;
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
    if (!isRunning) setInputEnabled(false);
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
    screensHost.addEventListener("mousedown", focusInputIfAwaiting);
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

  // Keep typed characters visible; scroll as PRINT / prompt text grows.
  const mo = typeof MutationObserver !== "undefined"
    ? new MutationObserver(scrollMountToEnd)
    : null;
  if (mo) mo.observe(output, { childList: true, characterData: true, subtree: true });

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
