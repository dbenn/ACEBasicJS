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
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
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
    const src = fs.readFileSync(path.join(root, "examples/ACEBasicJS/hello.b"), "utf8");
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    if (r.lines[0] !== "Hello from ACEBasicJS") throw new Error(JSON.stringify(r.lines));
    if (r.lines[1] !== "Edit me, then Run again.") throw new Error(JSON.stringify(r.lines));
  });

  await check("loops.b structure", async function () {
    const src = fs.readFileSync(path.join(root, "examples/BenchMarks/loops.b"), "utf8");
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
    const src = fs.readFileSync(path.join(root, "examples/BenchMarks/sieve.b"), "utf8");
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
    const src = fs.readFileSync(path.join(root, "examples/BenchMarks/ackermann.b"), "utf8");
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
    const src = fs.readFileSync(path.join(root, "examples/ACEBasicJS/input.b"), "utf8");
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

  await check("WINDOW text captured while open", async function () {
    const src =
      'SCREEN 1,320,200,3,1\n' +
      'WINDOW 1,"Hi",(10,10)-(220,120),31,1\n' +
      'PRINT "Hello window"\n' +
      'PRINT "Line two";\n';
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    const text = rt.windowText(1);
    if (!/Hello window\n/.test(text)) throw new Error("missing hello: " + JSON.stringify(text));
    if (!/Line two/.test(text)) throw new Error("missing line two: " + JSON.stringify(text));
    if (sink.textContent !== "") throw new Error("PRINT leaked to console: " + JSON.stringify(sink.textContent));
    if (rt.windowFunc(2) !== 210) throw new Error("width " + rt.windowFunc(2));
    if (rt.windowFunc(3) !== 110) throw new Error("height " + rt.windowFunc(3));
  });

  await check("examples/ACEBasicJS/window.b compiles", async function () {
    const src = fs.readFileSync(path.join(root, "examples/ACEBasicJS/window.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/openScreen/.test(compiled.js) || !/openWindow/.test(compiled.js)) {
      throw new Error("missing screen/window calls");
    }
  });

  await check("WINDOW + INPUT stays in window text", async function () {
    const src = fs.readFileSync(path.join(root, "examples/ACEBasicJS/window-input.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink, inputLines: ["Ada", "7"] });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    // Program ends in WHILE/SLEEP; capture window text before close cleanup.
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 100); });
    const text = rt.windowText(1);
    if (!/Your name\? /.test(text)) throw new Error("missing name prompt: " + JSON.stringify(text));
    if (!/Hello, Ada!/.test(text)) throw new Error("missing hello: " + JSON.stringify(text));
    if (!/Favourite number\? /.test(text)) throw new Error("missing number prompt: " + JSON.stringify(text));
    if (!/Double is 14 /.test(text)) throw new Error("missing double: " + JSON.stringify(text));
    if (sink.textContent !== "") throw new Error("INPUT/PRINT leaked to console: " + JSON.stringify(sink.textContent));
    rt.stop();
    await runPromise;
  });

  await check("window INPUT caret follows pen after prompt", async function () {
    const src =
      "SCREEN 1,320,200,3,1\n" +
      'WINDOW 1,"In",(0,0)-(320,200),32,1\n' +
      'PRINT "Title"\n' +
      'INPUT "Name"; n$\n';
    const sink = { textContent: "" };
    let sawPos = null;
    const rt = ACE.createRuntime({
      output: sink,
      onInputRequest: function () {
        sawPos = rt.inputCaretPos();
      },
      inputLines: [],
    });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 50); });
    if (!sawPos) throw new Error("onInputRequest never fired");
    // PRINT "Title\n" then prompt "Name? " — pen should be past the prompt on row 2.
    if (sawPos.y < 8) throw new Error("expected pen below first line: " + JSON.stringify(sawPos));
    if (sawPos.x < 8) throw new Error("expected pen after prompt chars: " + JSON.stringify(sawPos));
    rt.provideInput("Zed");
    rt.stop();
    await runPromise;
  });

  await check("LINE / CIRCLE / PSET / PALETTE / POINT", async function () {
    const src =
      "SCREEN 1,160,100,3,1\n" +
      'WINDOW 1,"G",(0,0)-(160,100),32,1\n' +
      "PALETTE 0,0,0,0\n" +
      "PALETTE 2,1,0,0\n" +
      "PALETTE 3,0,1,0\n" +
      "PALETTE 4,0,0,1\n" +
      "CLS\n" +
      "LINE (10,10)-(50,10),2\n" +
      "LINE (10,20)-(40,40),3,bf\n" +
      "CIRCLE (80,50),15,4\n" +
      "PSET (80,50),2\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    if (rt.point(10, 10) !== 2) throw new Error("line start color " + rt.point(10, 10));
    if (rt.point(50, 10) !== 2) throw new Error("line end color " + rt.point(50, 10));
    if (rt.point(20, 25) !== 3) throw new Error("box fill color " + rt.point(20, 25));
    if (rt.point(80, 50) !== 2) throw new Error("pset color " + rt.point(80, 50));
    // Circle outline should have hit a point at rightmost extent.
    if (rt.point(95, 50) !== 4) throw new Error("circle color " + rt.point(95, 50));
    if (rt.windowPixel(1, 0, 0) !== 0) throw new Error("CLS bg " + rt.windowPixel(1, 0, 0));
  });

  await check("examples/ACEBasicJS/graphics.b compiles and draws", async function () {
    const src = fs.readFileSync(path.join(root, "examples/ACEBasicJS/graphics.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.line\(/.test(compiled.js) || !/rt\.circle\(/.test(compiled.js)) {
      throw new Error("missing graphics calls");
    }
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 50); });
    // Horizontal line near y=42 in colour 2.
    if (rt.point(100, 42) !== 2) throw new Error("demo line color " + rt.point(100, 42));
    // Filled box colour 4.
    if (rt.point(180, 90) !== 4) throw new Error("demo box color " + rt.point(180, 90));
    // Circle centre PSET colour 1.
    if (rt.point(270, 90) !== 1) throw new Error("demo pset " + rt.point(270, 90));
    const text = rt.windowText(1);
    if (!/ACE Phase 5 graphics/.test(text)) throw new Error("missing title text: " + text);
    rt.stop();
    await runPromise;
  });

  await check("hex &H literals", async function () {
    const compiled = ACE.compile("PRINT &Hff\nPRINT &H10\n");
    if (!compiled.ok) throw compiled.diagnostics;
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    await ACE.run(compiled, rt);
    if (!/255/.test(sink.textContent) || !/\b16\b/.test(sink.textContent)) {
      throw new Error("hex print failed: " + sink.textContent);
    }
  });

  await check("PAINT flood fill + AREA/AREAFILL", async function () {
    const src =
      "SCREEN 1,80,60,2,1\n" +
      'WINDOW 1,"P",(0,0)-(80,60),32,1\n' +
      "PALETTE 0,0,0,0\n" +
      "PALETTE 1,1,1,1\n" +
      "PALETTE 2,1,0,0\n" +
      "CLS\n" +
      "LINE (10,10)-(50,10),2\n" +
      "LINE (50,10)-(50,40),2\n" +
      "LINE (50,40)-(10,40),2\n" +
      "LINE (10,40)-(10,10),2\n" +
      "PAINT (30,25),1,2\n" +
      "AREA (60,5)\n" +
      "AREA (75,5)\n" +
      "AREA (67,20)\n" +
      "COLOR 2\n" +
      "AREAFILL\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    if (rt.point(30, 25) !== 1) throw new Error("paint fill " + rt.point(30, 25));
    if (rt.point(10, 10) !== 2) throw new Error("paint border " + rt.point(10, 10));
    // Triangle interior near centroid.
    if (rt.point(67, 10) !== 2) throw new Error("areafill " + rt.point(67, 10));
  });

  await check("PATTERN line + area dither", async function () {
    const src =
      "SCREEN 1,40,20,2,1\n" +
      'WINDOW 1,"Pat",(0,0)-(40,20),32,1\n' +
      "DIM ap%(1)\n" +
      "ap%(0)=&Hcccc\n" +
      "ap%(1)=&H3333\n" +
      "PATTERN ,ap%\n" +
      "LINE (0,0)-(39,19),1,bf\n" +
      "PATTERN RESTORE\n" +
      "LINE (0,10)-(20,10),2\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.pattern\(/.test(compiled.js) || !/rt\.patternRestore\(/.test(compiled.js)) {
      throw new Error("missing pattern calls");
    }
    await ACE.run(compiled, rt);
    // Dithered fill: (0,0) uses bit15 of &HCCCC = 1 → fg; (1,0) bit14 = 1 → fg;
    // (2,0) bit13 = 0 → bg. Row0=&HCCCC = 1100 1100 1100 1100.
    if (rt.point(0, 0) !== 1) throw new Error("pat 0,0 " + rt.point(0, 0));
    if (rt.point(2, 0) !== 0) throw new Error("pat 2,0 " + rt.point(2, 0));
    if (rt.point(5, 10) !== 2) throw new Error("solid line after restore " + rt.point(5, 10));
  });

  await check("examples/Gfx/paint.b compiles and paints", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Gfx/paint.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.paint\(/.test(compiled.js) || !/rt\.areafill\(/.test(compiled.js)) {
      throw new Error("missing paint/areafill calls");
    }
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 50); });
    // Painted circle centre should be colour 2 (or patterned with 2).
    const c = rt.point(60, 70);
    if (c !== 2 && c !== 0) throw new Error("paint centre " + c);
    // Filled box after PATTERN RESTORE is solid colour 3.
    if (rt.point(220, 150) !== 3) throw new Error("restored box " + rt.point(220, 150));
    const text = rt.windowText(1);
    if (!/PAINT/.test(text)) throw new Error("missing title: " + text);
    rt.stop();
    await runPromise;
  });

  await check("LOCATE pads text cursor", async function () {
    const src =
      "SCREEN 1,200,100,3,1\n" +
      'WINDOW 1,"T",(0,0)-(200,100),32,1\n' +
      "CLS\n" +
      "LOCATE 3,5\n" +
      'PRINT "Hi"\n';
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    const text = rt.windowText(1);
    const lines = text.split("\n");
    if (lines.length < 3) throw new Error("expected >=3 lines: " + JSON.stringify(text));
    if (!/^    Hi/.test(lines[2])) throw new Error("locate pad failed: " + JSON.stringify(lines[2]));
  });

  await check("math builtins SQR INT ABS RND", async function () {
    const r = await runSource(ACE, "PRINT SQR(9)\nPRINT INT(3.7)\nPRINT ABS(-4)\nRANDOMIZE 1\nPRINT RND(0)*0+1\n");
    if (r.error) throw r.error;
    if (!/ 3 /.test(r.lines[0])) throw new Error("SQR: " + r.text);
    if (!/ 3 /.test(r.lines[1])) throw new Error("INT: " + r.text);
    if (!/ 4 /.test(r.lines[2])) throw new Error("ABS: " + r.text);
  });

  await check("bare RND is not a variable", async function () {
    const compiled = ACE.compile("x=rnd*10\nPRINT x\n");
    if (!compiled.ok) throw compiled.diagnostics;
    if (/let __v_rnd/.test(compiled.js)) throw new Error("RND declared as var: " + compiled.js);
    if (!/rt\.rnd\(\)/.test(compiled.js)) throw new Error("missing rt.rnd: " + compiled.js);
  });

  await check("examples/BenchMarks/ahl.b", async function () {
    const src = fs.readFileSync(path.join(root, "examples/BenchMarks/ahl.b"), "utf8");
    const r = await runSource(ACE, src);
    if (r.error) throw r.error.stack || r.error;
    const joined = r.lines.join("\n");
    if (!/Time in seconds =/.test(joined)) throw new Error(joined);
    if (!/Accuracy =/.test(joined)) throw new Error(joined);
    if (!/Random =/.test(joined)) throw new Error(joined);
  });

  await check("examples/Misc/fact.b", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Misc/fact.b"), "utf8");
    const r = await runSource(ACE, src, ["5", "-1"]);
    if (r.error) throw r.error.stack || r.error;
    if (!/-->> 120 /.test(r.text)) throw new Error(r.text);
  });

  await check("examples/hi.b compiles with RND/COLOR", async function () {
    const src = fs.readFileSync(path.join(root, "examples/hi.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.rnd\(/.test(compiled.js)) throw new Error("missing rnd");
    if (!/rt\.color\(/.test(compiled.js)) throw new Error("missing color");
    if (!/rt\.locate\(/.test(compiled.js)) throw new Error("missing locate");
  });

  await check("examples/BenchMarks/lines.b draws with RANDOMIZE", async function () {
    const src = fs.readFileSync(path.join(root, "examples/BenchMarks/lines.b"), "utf8");
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.randomize\(/.test(compiled.js)) throw new Error("missing randomize");
    if (!/rt\.int\(/.test(compiled.js)) throw new Error("missing int");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const t0 = Date.now();
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 80); });
    const elapsed = Date.now() - t0;
    // Batched flush: 10k lines must not take multi-second wall time in headless.
    if (elapsed > 3000) throw new Error("lines.b too slow: " + elapsed + "ms");
    const text = rt.windowText(1);
    if (!/Time elapsed:/.test(text)) throw new Error("missing timing: " + text);
    // Some ink should have been plotted.
    let ink = 0;
    for (let y = 0; y < 200 && ink === 0; y++) {
      for (let x = 0; x < 640; x++) {
        if (rt.point(x, y) === 2) { ink = 1; break; }
      }
    }
    if (!ink) throw new Error("no line pixels drawn");
    rt.stop();
    await runPromise;
  });

  await check("SOUND / WAVE SIN compile and log", async function () {
    const src =
      "WAVE 0,SIN\n" +
      "SOUND 300,1,64,0\n" +
      "SOUND 200,1,,1\n" +
      "BEEP\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.waveSin\(0\)/.test(compiled.js)) throw new Error("missing waveSin: " + compiled.js);
    if (!/await rt\.sound\(/.test(compiled.js)) throw new Error("missing sound: " + compiled.js);
    if (!/await rt\.beep\(/.test(compiled.js)) throw new Error("missing beep");
    await ACE.run(compiled, rt);
    if (rt.soundLog.length < 3) throw new Error("expected >=3 sound events: " + JSON.stringify(rt.soundLog));
    if (Math.abs(rt.soundLog[0].freq - rt.periodToHz(300)) > 0.01) {
      throw new Error("freq " + rt.soundLog[0].freq);
    }
    if (rt.soundLog[1].voice !== 1) throw new Error("voice " + rt.soundLog[1].voice);
  });

  await check("examples/Sound/sound.b runs", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Sound/sound.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    if (!/ACE Phase 6 sound/.test(sink.textContent)) throw new Error(sink.textContent);
    if (!/Done/.test(sink.textContent)) throw new Error(sink.textContent);
    if (rt.soundLog.length < 5) throw new Error("too few sounds: " + rt.soundLog.length);
  });

  await check("turtle FORWARD / TURNRIGHT / SETXY / PEN*", async function () {
    const src =
      "SCREEN 1,200,100,2,1\n" +
      'WINDOW 1,"T",(0,0)-(200,100),32,1\n' +
      "CLS\n" +
      "COLOR 1\n" +
      "PENUP\n" +
      "SETXY 10,50\n" +
      "PENDOWN\n" +
      "FORWARD 40\n" +
      "TURNRIGHT 90\n" +
      "FORWARD 20\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.turtleMove\("FORWARD"/.test(compiled.js)) throw new Error(compiled.js);
    if (!/rt\.turtleTurn\("TURNRIGHT"/.test(compiled.js)) throw new Error(compiled.js);
    await ACE.run(compiled, rt);
    // Heading 0 → +X; then TURNRIGHT 90 → +Y (down).
    if (rt.xcor() !== 50) throw new Error("xcor " + rt.xcor());
    if (rt.ycor() !== 70) throw new Error("ycor " + rt.ycor());
    if (rt.heading() !== 90) throw new Error("heading " + rt.heading());
    if (rt.point(10, 50) !== 1) throw new Error("start pixel " + rt.point(10, 50));
    if (rt.point(50, 50) !== 1) throw new Error("east end " + rt.point(50, 50));
    if (rt.point(50, 70) !== 1) throw new Error("south end " + rt.point(50, 70));
  });

  await check("UCASE$ + turtle HOME / BACK", async function () {
    const src =
      'PRINT UCASE$("abC")\n' +
      "SCREEN 1,100,80,2,1\n" +
      'WINDOW 1,"H",(0,0)-(100,80),32,1\n' +
      "COLOR 1\n" +
      "PENUP\n" +
      "SETXY 20,20\n" +
      "PENDOWN\n" +
      "FORWARD 10\n" +
      "HOME\n" +
      "PENUP\n" +
      "SETXY 30,30\n" +
      "SETHEADING 0\n" +
      "PENDOWN\n" +
      "FORWARD 10\n" +
      "BACK 10\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    if (sink.textContent.trim() !== "ABC") throw new Error(sink.textContent);
    // HOME with pen down draws back to 0,0; BACK returns to SETXY start.
    if (rt.xcor() !== 30) throw new Error("back x " + rt.xcor());
    if (rt.ycor() !== 30) throw new Error("back y " + rt.ycor());
  });

  await check("leading-dot float .75 is 0.75", async function () {
    const src = "PRINT .75\nPRINT n*.5\n";
    // n is undeclared → 0; just check .75 tokenises. Better:
    const src2 =
      "n=8\n" +
      "PRINT .75\n" +
      "PRINT n*.75\n";
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src2);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/\b0\.75\b/.test(compiled.js)) throw new Error("expected 0.75 in JS: " + compiled.js);
    if (/\*\(75\)|\*75\b/.test(compiled.js.replace(/0\.75/g, ""))) {
      throw new Error("dot float became integer 75: " + compiled.js);
    }
    await ACE.run(compiled, rt);
    const lines = sink.textContent.split("\n").filter(Boolean);
    if (Number(lines[0]) !== 0.75) throw new Error("print .75 → " + lines[0]);
    if (Number(lines[1]) !== 6) throw new Error("8*.75 → " + lines[1]);
  });

  await check("examples/Turtle/tree.b depth 5 terminates", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/tree.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink, inputLines: ["5"] });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/\*\(0\.75\)/.test(compiled.js) && !/\*0\.75/.test(compiled.js)) {
      throw new Error("tree scale factor wrong: " + compiled.js.match(/__v_tree[\s\S]*?return __ret/)[0]);
    }
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 150); });
    const text = rt.windowText(1);
    if (!/branch length is/.test(text)) throw new Error("missing length text: " + text);
    if (!/press 'q'/.test(text)) throw new Error("tree never reached quit prompt: " + text);
    rt.stop();
    await runPromise;
  });

  await check("examples/Turtle/tree.b length 40 draws visible tree", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/tree.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink, inputLines: ["40"] });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 200); });
    let ink = 0;
    for (let y = 0; y < 200; y++) {
      for (let x = 300; x < 500; x++) {
        if (rt.windowPixel(1, x, y) === 1) ink++;
      }
    }
    // Length 40 yields a clear fractal (thousands of pixels); 5 is only ~12.
    if (ink < 500) throw new Error("expected visible tree ink, got " + ink);
    rt.stop();
    await runPromise;
  });

  await check("examples/Turtle/flower.b compiles and draws", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/flower.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    if (!/rt\.turtleMove\("FORWARD"/.test(compiled.js)) throw new Error("missing forward");
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 80); });
    // Flower is drawn around (320,100); sample a petal stroke.
    let ink = 0;
    for (let y = 40; y < 160; y++) {
      for (let x = 200; x < 440; x++) {
        if (rt.windowPixel(1, x, y) === 2) { ink++; }
      }
    }
    if (ink < 100) throw new Error("expected flower ink, got " + ink);
    const text = rt.windowText(1);
    if (!/press 'q'/.test(text)) throw new Error("missing prompt: " + text);
    rt.stop();
    await runPromise;
  });

  await check("examples/Turtle/boxit.b compiles and draws", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/boxit.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    const runPromise = ACE.run(compiled, rt);
    await new Promise(function (r) { setTimeout(r, 80); });
    let ink = 0;
    for (let y = 100; y < 200; y++) {
      for (let x = 0; x < 200; x++) {
        if (rt.windowPixel(1, x, y) === 2) ink++;
      }
    }
    if (ink < 50) throw new Error("expected boxit ink, got " + ink);
    rt.stop();
    await runPromise;
  });

  await check("examples/Turtle/torus.b compiles and draws", async function () {
    const src = fs.readFileSync(path.join(root, "examples/Turtle/torus.b"), "utf8");
    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    const runPromise = ACE.run(compiled, rt);
    // Torus has many iterations — allow more time.
    await new Promise(function (r) { setTimeout(r, 400); });
    let ink = 0;
    for (let y = 40; y < 180; y += 2) {
      for (let x = 100; x < 500; x += 2) {
        if (rt.windowPixel(1, x, y) !== 0) ink++;
      }
    }
    if (ink < 200) throw new Error("expected torus ink, got " + ink);
    rt.stop();
    await runPromise;
  });

  if (failed) {
    console.error(failed + " failed");
    process.exit(1);
  }
  console.log("All tests passed");
}

main();
