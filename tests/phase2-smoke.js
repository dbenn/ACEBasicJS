/* Node smoke tests for Phase 2 compiler (no browser). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const runtimeSrc = fs.readFileSync(path.join(root, "src/runtime/runtime.js"), "utf8");
const compilerSrc = fs.readFileSync(path.join(root, "src/compiler/compiler.js"), "utf8");

function loadAce() {
  const ctx = { console: console, Date: Date, Math: Math, Array: Array, Object: Object, JSON: JSON, Number: Number, String: String };
  vm.createContext(ctx);
  vm.runInContext(runtimeSrc, ctx);
  vm.runInContext(compilerSrc, ctx);
  return ctx.ACE;
}

function runSource(ACE, source) {
  const lines = [];
  const rt = {
    stopped: false,
    _t0: Date.now(),
    print: function () {
      const parts = [];
      for (let i = 0; i < arguments.length; i++) {
        const v = arguments[i];
        if (typeof v === "number" && isFinite(v)) parts.push((v >= 0 ? " " : "") + String(v));
        else parts.push(String(v));
      }
      lines.push(parts.join(""));
    },
    timer: function () {
      return (Date.now() - this._t0) / 1000;
    },
    stop: function () {
      this.stopped = true;
    },
    reset: function () {
      this.stopped = false;
      lines.length = 0;
    },
  };
  const compiled = ACE.compile(source);
  if (!compiled.ok) {
    return { compiled: compiled, lines: lines, error: compiled.diagnostics };
  }
  try {
    ACE.run(compiled, rt);
  } catch (e) {
    return { compiled: compiled, lines: lines, error: e };
  }
  return { compiled: compiled, lines: lines };
}

const ACE = loadAce();
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e && e.stack ? e.stack : e);
  }
}

check("hello.b", function () {
  const src = fs.readFileSync(path.join(root, "examples/hello.b"), "utf8");
  const r = runSource(ACE, src);
  if (r.error) throw r.error;
  if (r.lines[0] !== "Hello from ACEBasicJS") throw new Error(JSON.stringify(r.lines));
  if (r.lines[1] !== "Edit me, then Run again.") throw new Error(JSON.stringify(r.lines));
});

check("loops.b structure", function () {
  const src = fs.readFileSync(path.join(root, "examples/loops.b"), "utf8");
  // shrink constants for speed in tests
  const small = src.replace("CONST x=400, y=150", "CONST x=20, y=10");
  const r = runSource(ACE, small);
  if (r.error) throw (r.error.stack || r.error);
  const joined = r.lines.join("\n");
  if (!/FOR:/.test(joined)) throw new Error("missing FOR: " + joined);
  if (!/WHILE:/.test(joined)) throw new Error("missing WHILE: " + joined);
  if (!/REPEAT:/.test(joined)) throw new Error("missing REPEAT: " + joined);
  // 5 passes * 3 kinds = at least 15 timing lines + blank prints
  if (r.lines.length < 15) throw new Error("too few lines: " + r.lines.length + " " + joined);
});

check("sieve.b", function () {
  const src = fs.readFileSync(path.join(root, "examples/sieve.b"), "utf8");
  // shrink for speed
  const small = src
    .replace(/MAX=7000/g, "MAX=200")
    .replace(/DIM FLAGS\(7000\)/g, "DIM FLAGS(200)")
    .replace(/7000 numbers/g, "200 numbers");
  const r = runSource(ACE, small);
  if (r.error) throw (r.error.stack || JSON.stringify(r.error));
  const joined = r.lines.join("\n");
  if (!/BYTE SIEVE/.test(joined)) throw new Error(joined);
  if (!/primes found/.test(joined)) throw new Error(joined);
});

check("ackermann.b", function () {
  const src = fs.readFileSync(path.join(root, "examples/ackermann.b"), "utf8");
  const r = runSource(ACE, src);
  if (r.error) throw (r.error.stack || JSON.stringify(r.error));
  // Ackermann(3,1)=13, Ackermann(3,2)=29 with k starting 16: k-3=13 then after k=32, k-3=29
  if (r.lines.map(function(l){return l.trim()}).indexOf("13") < 0) throw new Error("no 13: " + r.lines.join("|"));
  if (r.lines.map(function(l){return l.trim()}).indexOf("29") < 0) throw new Error("no 29: " + r.lines.join("|"));
  if (r.lines.some(function (l) { return /wrong value/.test(l); })) {
    throw new Error("wrong value: " + r.lines.join("|"));
  }
});

if (failed) {
  console.error(failed + " failed");
  process.exit(1);
}
console.log("All tests passed");
