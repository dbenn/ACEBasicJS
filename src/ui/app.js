/* ACEBasicJS host UI — picker + always-visible editable source + INPUT. */
(function () {
  "use strict";

  const picker = document.getElementById("program-picker");
  const source = document.getElementById("source");
  const output = document.getElementById("output");
  const status = document.getElementById("status");
  const runBtn = document.getElementById("run");
  const stopBtn = document.getElementById("stop");
  const inputRow = document.getElementById("input-row");
  const consoleInput = document.getElementById("console-input");

  let runToken = 0;

  function setInputEnabled(on) {
    inputRow.hidden = !on;
    consoleInput.disabled = !on;
    if (on) {
      consoleInput.value = "";
      consoleInput.focus();
    }
  }

  const runtime = ACE.createRuntime({
    output: output,
    onInputRequest: function () {
      setInputEnabled(true);
    },
    onInputDone: function () {
      setInputEnabled(false);
    },
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
    if (consoleInput.disabled) return;
    runtime.provideInput(consoleInput.value);
    consoleInput.value = "";
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
  consoleInput.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      submitConsoleInput();
    }
  });

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
