/* Smoke tests for STRUCT / pointer / bst.b */
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
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Uint8ClampedArray: Uint8ClampedArray,
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
    return { compiled: compiled, text: sink.textContent, error: compiled.diagnostics, rt: rt };
  }
  try {
    await ACE.run(compiled, rt);
  } catch (e) {
    return { compiled: compiled, text: sink.textContent, error: e, rt: rt };
  }
  return { compiled: compiled, text: sink.textContent, rt: rt };
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
  await check("sizeof / Alloc / *& / ->", async function () {
    const src =
      "struct node\n" +
      "  single item\n" +
      "  longint lchild\n" +
      "  longint rchild\n" +
      "end struct\n" +
      "declare struct node *t\n" +
      "const nil=0&\n" +
      "t=nil\n" +
      "t=Alloc(sizeof(node))\n" +
      "t->item=42\n" +
      "t->lchild=nil\n" +
      "print t->item\n" +
      "print sizeof(node)\n";
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    if (!/^ *42 *\n *12 *\n?$/.test(r.text)) throw new Error(JSON.stringify(r.text));
  });

  await check("@ / *& poke assign (by-ref)", async function () {
    const src =
      "longint n\n" +
      "n=7\n" +
      "SUB bump(ADDRESS a)\n" +
      "  *&a := *&a + 1\n" +
      "END SUB\n" +
      "CALL bump(@n)\n" +
      "print n\n";
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    if (!/^ *8 *\n?$/.test(r.text)) throw new Error(JSON.stringify(r.text));
  });

  await check("CASE / END CASE", async function () {
    const src =
      "opt=2\n" +
      "CASE\n" +
      "  opt=1 : print \"one\"\n" +
      "  opt=2 : print \"two\"\n" +
      "  opt=3 : print \"three\"\n" +
      "END CASE\n";
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    if (!/two/.test(r.text) || /one|three/.test(r.text)) throw new Error(JSON.stringify(r.text));
  });

  await check("STR$ LEN RIGHT$", async function () {
    const src =
      'n$=STR$(12)\n' +
      'print LEN(n$)\n' +
      'print RIGHT$(n$,2)\n';
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    const lines = r.text.split("\n").filter(Boolean);
    if (lines[0].trim() !== "3") throw new Error("LEN " + r.text);
    if (lines[1].trim() !== "12") throw new Error("RIGHT$ " + r.text);
  });

  await check("examples/Turtle/bst.b compiles", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/bst.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
  });

  await check("examples/Turtle/bst.b insert / height / count / max / inorder", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/bst.b"), "utf8");

    async function runUntilPrompt(inputs) {
      const sink = { textContent: "" };
      const rt = ACE.createRuntime({ output: sink, inputLines: inputs.slice() });
      const compiled = ACE.compile(src);
      if (!compiled.ok) throw compiled.diagnostics;
      const runP = ACE.run(compiled, rt);
      for (let i = 0; i < 80; i++) {
        await new Promise(function (r) { setTimeout(r, 5); });
        if (rt.awaitingInput) break;
      }
      return { rt: rt, runP: runP };
    }

    // Insert 50,30,70 then height — catch height before later prepare_for_output wipes line 14.
    let sess = await runUntilPrompt(["1", "50", "1", "30", "1", "70", "4"]);
    let w2 = sess.rt.windowText(2) || "";
    if (!/Height of tree is\s*2/.test(w2)) throw new Error("height: " + w2);
    if (sess.rt.awaitingInput) sess.rt.provideInput("0");
    await sess.runP;

    sess = await runUntilPrompt(["1", "50", "1", "30", "1", "70", "6"]);
    w2 = sess.rt.windowText(2) || "";
    if (!/Number of nodes in tree is\s*3/.test(w2)) throw new Error("count: " + w2);
    if (sess.rt.awaitingInput) sess.rt.provideInput("0");
    await sess.runP;

    sess = await runUntilPrompt(["1", "50", "1", "30", "1", "70", "5"]);
    w2 = sess.rt.windowText(2) || "";
    if (!/Maximum item is\s*70/.test(w2)) throw new Error("max: " + w2);
    if (sess.rt.awaitingInput) sess.rt.provideInput("0");
    await sess.runP;

    sess = await runUntilPrompt(["1", "50", "1", "30", "1", "70", "3", "2"]);
    w2 = sess.rt.windowText(2) || "";
    if (!/30\s+50\s+70/.test(w2.replace(/\n/g, " "))) throw new Error("inorder: " + w2);
    if (sess.rt.awaitingInput) sess.rt.provideInput("0");
    await sess.runP;
  });

  if (failed) {
    console.error(failed + " failure(s)");
    process.exit(1);
  }
  console.log("All bst tests passed");
}

main();
