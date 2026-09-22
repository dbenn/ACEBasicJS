/* ACEBasicJS runtime — console I/O + TIMER (Phase 2). */
(function (global) {
  "use strict";

  function createRuntime(options) {
    const output = options && options.output;
    let stopped = false;
    const startMs = Date.now();

    function clear() {
      if (output) output.textContent = "";
    }

    /** AmigaBASIC-ish PRINT: join parts, then newline. */
    function print() {
      if (stopped) return;
      const parts = [];
      for (let i = 0; i < arguments.length; i++) {
        const v = arguments[i];
        if (v === undefined || v === null) parts.push("");
        else if (typeof v === "number" && isFinite(v)) {
          // AmigaBASIC-ish: leading space for non-negative numbers
          parts.push((v >= 0 ? " " : "") + String(v));
        } else parts.push(String(v));
      }
      const line = parts.join("");
      if (output) output.textContent += line + "\n";
      else if (typeof console !== "undefined") console.log(line);
    }

    /** Seconds since runtime start (deltas match ACE TIMER usage in benchmarks). */
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
