/* ACEBasicJS host UI — picker + always-visible editable source. */
(function () {
  "use strict";

  const picker = document.getElementById("program-picker");
  const source = document.getElementById("source");
  const output = document.getElementById("output");
  const status = document.getElementById("status");
  const runBtn = document.getElementById("run");
  const stopBtn = document.getElementById("stop");

  const runtime = ACE.createRuntime({ output: output });
  let manifest = [];
  let running = false;

  function setStatus(message, kind) {
    status.textContent = message || "";
    status.dataset.kind = kind || "info";
  }

  function setRunning(isRunning) {
    running = isRunning;
    runBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;
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

  function runCurrent() {
    runtime.reset();
    setRunning(true);
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
      ACE.run(compiled, runtime);
      setStatus("Ran successfully.", "info");
    } catch (err) {
      runtime.print(String(err && err.message ? err.message : err));
      setStatus("Run failed.", "error");
    } finally {
      setRunning(false);
    }
  }

  function stopCurrent() {
    runtime.stop();
    setRunning(false);
    setStatus("Stopped.", "info");
  }

  picker.addEventListener("change", function () {
    loadProgram(picker.value).catch(function (err) {
      setStatus(String(err.message || err), "error");
    });
  });

  runBtn.addEventListener("click", runCurrent);
  stopBtn.addEventListener("click", stopCurrent);

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
