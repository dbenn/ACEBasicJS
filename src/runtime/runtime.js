/* ACEBasicJS runtime — console I/O + TIMER. */
(function (global) {
  "use strict";

  function createRuntime(options) {
    const output = options && options.output;
    let stopped = false;
    const startMs = Date.now();

    function write(text) {
      if (stopped) return;
      if (output) output.textContent += text;
      else if (typeof console !== "undefined") {
        // Without a DOM sink, buffer incomplete lines for console.log
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
        // AmigaBASIC-ish: leading space for non-negative numbers
        return (v >= 0 ? " " : "") + String(v);
      }
      return String(v);
    }

    /**
     * ACE PRINT semantics (Language Reference):
     * - after[i] === ';' → no gap; if last, suppress newline before next PRINT
     * - after[i] === ',' → emit TAB; if last, suppress newline
     * - after[i] == null → end of statement → newline (when last)
     * - bare PRINT (no parts) → newline
     */
    function printParts(parts, after) {
      if (stopped) return;
      const ps = parts || [];
      const seps = after || [];
      let text = "";
      for (let i = 0; i < ps.length; i++) {
        text += formatValue(ps[i]);
        const sep = seps[i];
        if (sep === ",") text += "\t";
        // ';' adds nothing
      }
      const lastSep = ps.length ? seps[ps.length - 1] : null;
      const newline = ps.length === 0 || (lastSep !== ";" && lastSep !== ",");
      write(text + (newline ? "\n" : ""));
    }

    /** Convenience: PRINT args... always ends with newline. */
    function print() {
      const parts = [];
      const after = [];
      for (let i = 0; i < arguments.length; i++) {
        parts.push(arguments[i]);
        after.push(i === arguments.length - 1 ? null : ";");
      }
      printParts(parts, after);
    }

    function timer() {
      return (Date.now() - startMs) / 1000;
    }

    function stop() {
      stopped = true;
    }

    function reset() {
      stopped = false;
      clear();
    }

    return {
      print: print,
      printParts: printParts,
      formatValue: formatValue,
      timer: timer,
      clear: clear,
      stop: stop,
      reset: reset,
      get stopped() {
        return stopped;
      },
    };
  }

  global.ACE = global.ACE || {};
  global.ACE.createRuntime = createRuntime;
})(typeof window !== "undefined" ? window : globalThis);
