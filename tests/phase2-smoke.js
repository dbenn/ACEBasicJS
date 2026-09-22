/* Node smoke tests for compiler, PRINT separators, and INPUT. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const runtimeSrc = fs.readFileSync(path.join(root, "src/runtime/runtime.js"), "utf8");
const compilerSrc = fs.readFileSync(path.join(root, "src/compiler/compiler.js"), "utf8");

function loadAce() {
  const ctx = {
    console: console,
    Date: Date,
    Math: Math,
    Array: Array,
    Object: Object,
    JSON: JSON,
    Number: Number,
    String: String,
    isFinite: isFinite,
    parseFloat: parseFloat,
    Promise: Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(runtimeSrc, ctx);
  vm.runInContext(compilerSrc, ctx);
  return ctx.ACE;
}

async function runSource(ACE, source, inputLines) {
  const sink = { textContent: "" };
  const rt = ACE.createRuntime({ output: sink, inputLines: inputLines || [] });
  const compiled = ACE.compile(source);
  if (!compiled.ok) {
    return { compiled: compiled, text: sink.textContent, lines: [], error: compiled.diagnostics };
  }
  try {
    await ACE.run(compiled, rt);
  } catch (e) {
    return { compiled: compiled, text: sink.textContent, lines: sink.textContent.split("\n"), error: e };
  }
  const text = sink.textContent;
  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return { compiled: compiled, text: text, lines: lines };
}

const ACE = loadAce();
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e && e.stack ? e.stack : e);
  }
}

async function main() {
  await check("hello.b", async function () {
    const src = fs.readFileSync(path.join(root, "examples/hello.b"), "utf8");
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    if (r.lines[0] !== "Hello from ACEBasicJS") throw new Error(JSON.stringify(r.lines));
    if (r.lines[1] !== "Edit me, then Run again.") throw new Error(JSON.stringify(r.lines));
  });

  await check("loops.b structure", async function () {
    const src = fs.readFileSync(path.join(root, "examples/loops.b"), "utf8");
    const small = src.replace("CONST x=400, y=150", "CONST x=20, y=10");
    const r = await runSource(ACE, small);
    if (r.error) throw r.error.stack || r.error;
    const joined = r.lines.join("\n");
    if (!/FOR:/.test(joined)) throw new Error("missing FOR: " + joined);
    if (!/WHILE:/.test(joined)) throw new Error("missing WHILE: " + joined);
    if (!/REPEAT:/.test(joined)) throw new Error("missing REPEAT: " + joined);
    if (r.lines.length < 15) throw new Error("too few lines: " + r.lines.length + " " + joined);
  });

  await check("sieve.b", async function () {
    const src = fs.readFileSync(path.join(root, "examples/sieve.b"), "utf8");
    const small = src
      .replace(/MAX=7000/g, "MAX=200")
      .replace(/DIM FLAGS\(7000\)/g, "DIM FLAGS(200)")
      .replace(/7000 numbers/g, "200 numbers");
    const r = await runSource(ACE, small);
    if (r.error) throw r.error.stack || JSON.stringify(r.error);
    const joined = r.lines.join("\n");
    if (!/BYTE SIEVE/.test(joined)) throw new Error(joined);
    if (!/primes found/.test(joined)) throw new Error(joined);
  });

  await check("ackermann.b", async function () {
    const src = fs.readFileSync(path.join(root, "examples/ackermann.b"), "utf8");
    const r = await runSource(ACE, src);
    if (r.error) throw r.error.stack || JSON.stringify(r.error);
    const trimmed = r.lines.map(function (l) { return l.trim(); });
    if (trimmed.indexOf("13") < 0) throw new Error("no 13: " + r.lines.join("|"));
    if (trimmed.indexOf("29") < 0) throw new Error("no 29: " + r.lines.join("|"));
    if (r.lines.some(function (l) { return /wrong value/.test(l); })) {
      throw new Error("wrong value: " + r.lines.join("|"));
    }
  });

  await check("PRINT trailing semicolon joins lines", async function () {
    const r = await runSource(ACE, 'PRINT "A";\nPRINT "B"\n');
    if (r.error) throw r.error;
    if (r.text !== "AB\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT mid semicolon concatenates", async function () {
    const r = await runSource(ACE, 'PRINT "A";"B"\n');
    if (r.error) throw r.error;
    if (r.text !== "AB\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT comma inserts tab", async function () {
    const r = await runSource(ACE, 'PRINT "A","B"\n');
    if (r.error) throw r.error;
    if (r.text !== "A\tB\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT bare is blank line", async function () {
    const r = await runSource(ACE, "PRINT\n");
    if (r.error) throw r.error;
    if (r.text !== "\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT trailing comma suppresses newline after tab", async function () {
    const r = await runSource(ACE, 'PRINT "A",\nPRINT "B"\n');
    if (r.error) throw r.error;
    if (r.text !== "A\tB\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT number padding with semicolon", async function () {
    const r = await runSource(ACE, 'PRINT "in";0.1;"seconds"\n');
    if (r.error) throw r.error;
    if (r.text !== "in 0.1 seconds\n") throw new Error(JSON.stringify(r.text));
  });

  await check("PRINT negative number padding", async function () {
    const r = await runSource(ACE, 'PRINT "x";-3.2;"y"\n');
    if (r.error) throw r.error;
    if (r.text !== "x-3.2 y\n") throw new Error(JSON.stringify(r.text));
  });

  await check("INPUT prompt and string/number", async function () {
    const src = fs.readFileSync(path.join(root, "examples/input.b"), "utf8");
    const r = await runSource(ACE, src, ["Ada", "7"]);
    if (r.error) throw r.error.stack || r.error;
    if (!/Your name\? /.test(r.text)) throw new Error("missing name prompt: " + JSON.stringify(r.text));
    if (!/Hello, Ada!/.test(r.text)) throw new Error("missing hello: " + JSON.stringify(r.text));
    if (!/Pick a number 1-10\? /.test(r.text)) throw new Error("missing number prompt: " + JSON.stringify(r.text));
    if (!/You picked 7 /.test(r.text) && !/You picked 7\n/.test(r.text) && !/You picked 7 /.test(r.text)) {
      // with number padding: "You picked" + " 7 " 
      if (!/You picked 7 /.test(r.text)) throw new Error("missing picked: " + JSON.stringify(r.text));
    }
    if (!/Double is 14 /.test(r.text)) throw new Error("missing double: " + JSON.stringify(r.text));
  });

  await check("INPUT comma suppresses question mark", async function () {
    const r = await runSource(ACE, 'INPUT "Name", n$\nPRINT n$\n', ["Zed"]);
    if (r.error) throw r.error;
    if (!r.text.startsWith("NameZed\n") && r.text !== "NameZed\n") {
      // prompt "Name" without "? ", then echo Zed\n, then PRINT n$\n
      if (r.text !== "NameZed\nZed\n") throw new Error(JSON.stringify(r.text));
    }
  });

  if (failed) {
    console.error(failed + " failed");
    process.exit(1);
  }
  console.log("All tests passed");
}

main();
