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

  await check("PRINTS leaves graphics pen unmoved (bst GraphTree labels)", async function () {
    const src =
      "WINDOW 1,\"T\",(0,0)-(640,200),6\n" +
      "CLS\n" +
      "penup\n" +
      "setxy 100,40\n" +
      "prints \"AB\"\n" +
      "x%=xcor\n" +
      "y%=ycor\n" +
      "setxy xcor+8,ycor\n" +
      "prints \"C\"\n" +
      "x2%=xcor\n" +
      "y2%=ycor\n" +
      "CLS\n" +
      "print x%\n" +
      "print y%\n" +
      "print x2%\n" +
      "print y2%\n";
    const r = await runSource(ACE, src);
    if (r.error) throw r.error;
    const lines = (r.rt.windowText(1) || "").split("\n").map(function (s) {
      return s.trim();
    }).filter(Boolean);
    // xcor/ycor unchanged by PRINTS; after setxy +8 → 108,40
    if (lines[0] !== "100") throw new Error("xcor after prints: " + JSON.stringify(lines));
    if (lines[1] !== "40") throw new Error("ycor after prints: " + JSON.stringify(lines));
    if (lines[2] !== "108") throw new Error("xcor after setxy: " + JSON.stringify(lines));
    if (lines[3] !== "40") throw new Error("ycor after setxy: " + JSON.stringify(lines));
  });

  await check("bst GraphTree node labels at distinct turtle positions", async function () {
    const src =
      "struct node\n" +
      "  single item\n" +
      "  longint lchild\n" +
      "  longint rchild\n" +
      "end struct\n" +
      "declare struct node *t\n" +
      "const nil=0&\n" +
      "SUB Insert(ADDRESS taddr,newitem)\n" +
      "declare struct node *t\n" +
      "  t = *&taddr\n" +
      "  if t = nil then\n" +
      "    t = Alloc(sizeof(node))\n" +
      "    t->item = newitem\n" +
      "    t->lchild = nil\n" +
      "    t->rchild = nil\n" +
      "    *&taddr := t\n" +
      "  else\n" +
      "    if newitem < t->item then\n" +
      "      Insert(@t->lchild, newitem)\n" +
      "    else\n" +
      "      Insert(@t->rchild, newitem)\n" +
      "    end if\n" +
      "  end if\n" +
      "END SUB\n" +
      "SUB GraphTree(ADDRESS taddr)\n" +
      "declare struct node *t\n" +
      "  t = taddr\n" +
      "  if t <> nil then\n" +
      "    setheading 135\n" +
      "    if t->lchild then pendown:forward 20\n" +
      "    GraphTree(t->lchild)\n" +
      "    setheading 135\n" +
      "    if t->lchild then penup:back 20\n" +
      "    setheading 45\n" +
      "    if t->rchild then pendown:forward 20\n" +
      "    GraphTree(t->rchild)\n" +
      "    setheading 45\n" +
      "    if t->rchild then penup:back 20\n" +
      "    num$=str$(t->item)\n" +
      "    if sgn(t->item) <> -1 then num$=right$(num$,len(num$)-1)\n" +
      "    halfnumlen%=len(num$)\\2\n" +
      "    penup\n" +
      "    setxy xcor-halfnumlen%*8,ycor\n" +
      "    prints num$\n" +
      "    setxy xcor+halfnumlen%*8,ycor\n" +
      "    pendown\n" +
      "  end if\n" +
      "END SUB\n" +
      "WINDOW 1,\"T\",(0,0)-(640,200),6\n" +
      "COLOR 2,1\n" +
      "CLS\n" +
      "t=nil\n" +
      "Insert(@t,50)\n" +
      "Insert(@t,30)\n" +
      "Insert(@t,70)\n" +
      "setheading 90\n" +
      "penup\n" +
      "setxy 320,20\n" +
      "pendown\n" +
      "GraphTree(t)\n";

    const sink = { textContent: "" };
    const rt = ACE.createRuntime({ output: sink });
    const positions = [];
    const origPrints = rt.prints;
    rt.prints = function (parts, after) {
      positions.push({ text: String((parts && parts[0]) || ""), x: rt.xcor(), y: rt.ycor() });
      return origPrints.apply(this, arguments);
    };
    const compiled = ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ACE.run(compiled, rt);
    if (positions.length !== 3) throw new Error("expected 3 labels: " + JSON.stringify(positions));
    // Postorder: left 30, right 70, root 50 — distinct positions, root near start.
    const byVal = {};
    positions.forEach(function (p) { byVal[p.text] = p; });
    if (!byVal["30"] || !byVal["50"] || !byVal["70"]) {
      throw new Error("missing labels: " + JSON.stringify(positions));
    }
    if (byVal["50"].x !== 320 - 8 || byVal["50"].y !== 20) {
      throw new Error("root label pos: " + JSON.stringify(byVal["50"]));
    }
    if (byVal["30"].x === byVal["50"].x && byVal["30"].y === byVal["50"].y) {
      throw new Error("left label stacked on root: " + JSON.stringify(positions));
    }
    if (byVal["70"].x === byVal["50"].x && byVal["70"].y === byVal["50"].y) {
      throw new Error("right label stacked on root: " + JSON.stringify(positions));
    }
    if (byVal["30"].x === byVal["70"].x && byVal["30"].y === byVal["70"].y) {
      throw new Error("children stacked: " + JSON.stringify(positions));
    }
    // Left child further left / down-left; right further right.
    if (!(byVal["30"].x < byVal["50"].x && byVal["70"].x > byVal["50"].x)) {
      throw new Error("expected L/R spread: " + JSON.stringify(positions));
    }
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

  await check("implicit screen grows for stacked WINDOWs (bst clip)", async function () {
    function el(tag) {
      const kids = [];
      const node = {
        tagName: String(tag || "div").toUpperCase(),
        className: "",
        style: {},
        dataset: {},
        children: kids,
        parentNode: null,
        textContent: "",
        width: 0,
        height: 0,
        setAttribute: function () {},
        appendChild: function (c) {
          kids.push(c);
          c.parentNode = node;
          return c;
        },
        removeChild: function (c) {
          const i = kids.indexOf(c);
          if (i >= 0) kids.splice(i, 1);
          c.parentNode = null;
          return c;
        },
        addEventListener: function () {},
        getContext: function () {
          return {
            createImageData: function (w, h) {
              return { data: new Uint8ClampedArray((w | 0) * (h | 0) * 4), width: w | 0, height: h | 0 };
            },
            putImageData: function () {},
          };
        },
      };
      return node;
    }
    const screensHost = el("div");
    screensHost.hidden = true;
    const fakeDoc = {
      createElement: function (tag) { return el(tag); },
      addEventListener: function () {},
      removeEventListener: function () {},
    };
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
      document: fakeDoc,
    };
    vm.createContext(ctx);
    vm.runInContext(runtimeSrc, ctx);
    vm.runInContext(compilerSrc, ctx);
    const sink = { textContent: "" };
    const rt = ctx.ACE.createRuntime({ output: sink, screensHost: screensHost });
    const src =
      'WINDOW 2,"Out",(0,0)-(640,150),6\n' +
      'WINDOW 1,"Menu",(0,150)-(640,270),6\n' +
      'PRINT "menu"\n';
    const compiled = ctx.ACE.compile(src);
    if (!compiled.ok) throw compiled.diagnostics;
    await ctx.ACE.run(compiled, rt);
    const scr = screensHost.children[0];
    if (!scr) throw new Error("no screen el");
    const h = parseInt(String(scr.style.height), 10);
    if (!(h >= 278)) throw new Error("screen height not grown: " + scr.style.height);
    let menu = null;
    function walk(n) {
      if (!n) return;
      if (n.className && String(n.className).indexOf("ace-window") >= 0 &&
          n.style && String(n.style.top) === "150px") {
        menu = n;
      }
      (n.children || []).forEach(walk);
    }
    walk(screensHost);
    if (!menu) throw new Error("menu window missing");
    if (String(menu.style.height) !== "120px") throw new Error("menu h " + menu.style.height);
  });

  if (failed) {
    console.error(failed + " failure(s)");
    process.exit(1);
  }
  console.log("All bst tests passed");
}

main();
