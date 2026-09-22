/* ACEBasicJS runtime — Phase 0 stub (console I/O only). */
(function (global) {
  "use strict";

  function createRuntime(options) {
    const output = options && options.output;
    let stopped = false;

    function clear() {
      if (output) output.textContent = "";
    }

    function print() {
      if (stopped || !output) return;
      const parts = [];
      for (let i = 0; i < arguments.length; i++) {
        parts.push(String(arguments[i]));
      }
      output.textContent += parts.join("") + "\n";
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
