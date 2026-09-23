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

  function syncLiveInput() {
    liveInput.textContent = consoleInput.value;
  }

  function scrollMountToEnd() {
    if (!inputMount) return;
    // Window content scrolls; console scrolls on itself.
    const scroller = inputMount.classList && inputMount.classList.contains("ace-content")
      ? inputMount
      : consoleEl;
    scroller.scrollTop = scroller.scrollHeight;
  }

  /** Mount live draft + caret + mirror field on the active text surface. */
  function mountInputOnSurface(surface) {
    const mount = surface || consoleEl;
    inputMount = mount;
    // Keep committed text first; append live draft after it.
    mount.appendChild(liveInput);
    mount.appendChild(caret);
    mount.appendChild(consoleInput);
    mount.classList.toggle("awaiting-input", awaitingInput);
    if (mount !== consoleEl) consoleEl.classList.remove("awaiting-input");
    else if (screensHost) {
      // Clear awaiting mark on any prior window content.
      const prev = screensHost.querySelectorAll(".ace-content.awaiting-input");
      for (let i = 0; i < prev.length; i++) prev[i].classList.remove("awaiting-input");
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
      consoleInput.focus();
      scrollMountToEnd();
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
        consoleInput.focus();
      }
    },
  });

  // Feed INKEY$ / SLEEP from keyboard when Display or screens have focus.
  document.addEventListener("keydown", function (ev) {
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

  async function loadManifest() {
    const res = await fetch("examples/manifest.json");
    if (!res.ok) throw new Error("Could not load examples/manifest.json");
    manifest = await res.json();
    picker.innerHTML = "";
    manifest.forEach(function (entry) {
      const opt = document.createElement("option");
      opt.value = entry.id;
      opt.textContent = entry.title;
      picker.appendChild(opt);
    });
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
    consoleInput.focus();
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
