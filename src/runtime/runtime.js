/* ACEBasicJS runtime — console I/O, TIMER, INPUT. */
(function (global) {
  "use strict";

  function createRuntime(options) {
    const output = options && options.output;
    const onInputRequest = options && options.onInputRequest;
    const onInputDone = options && options.onInputDone;
    let inputLines = (options && options.inputLines) ? options.inputLines.slice() : null;
    let stopped = false;
    const startMs = Date.now();
    let pendingInput = null;

    function write(text) {
      if (stopped) return;
      if (output) output.textContent += text;
      else if (typeof console !== "undefined") {
        write._buf = (write._buf || "") + text;
        const parts = write._buf.split("\n");
        write._buf = parts.pop();
        for (let i = 0; i < parts.length; i++) console.log(parts[i]);
      }
    }

    function clear() {
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

    function stop() {
      stopped = true;
      if (pendingInput) {
        const p = pendingInput;
        pendingInput = null;
        if (onInputDone) onInputDone();
        p.resolve("");
      }
    }

    function reset() {
      stopped = false;
      pendingInput = null;
      if (options && options.inputLines) inputLines = options.inputLines.slice();
      clear();
    }

    return {
      print: print,
      printParts: printParts,
      formatValue: formatValue,
      toNumber: toNumber,
      input: input,
      provideInput: provideInput,
      timer: timer,
      clear: clear,
      stop: stop,
      reset: reset,
      get stopped() {
        return stopped;
      },
      get awaitingInput() {
        return !!pendingInput;
      },
    };
  }

  global.ACE = global.ACE || {};
  global.ACE.createRuntime = createRuntime;
})(typeof window !== "undefined" ? window : globalThis);
