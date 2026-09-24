# ACEBasicJS Implementation Plan

*Lightweight, pure client-side path. Complements [`design_deac.md`](design_deac.md) and [`.cursorrules`](../.cursorrules).*

---

## Motivation

Reproduce what ACE did in **as simple an environment as possible**. Simulation of the AmigaOS API surface that ACE programs actually used is enough; full hardware emulation is not. Prefer the smallest stack that still runs real ACE programs faithfully.

Complexity is a defect. Avoid build systems, frameworks, and layers that do not earn their keep.

---

## Goal

Ship a **pure client-side** ACE experience in the browser:

1. Pick an existing program from a **program picker** (curated examples, later user files)
2. **Always see** the ACE source alongside the running program — source is never hidden behind “run only”
3. **Edit** that source in place, recompile, and run again
4. Compile **in the browser** to readable JavaScript
5. Run that JS against a small AmigaOS-inspired runtime (Canvas, Web Audio, Speech, IndexedDB)

No native toolchain required for end users. No Amiga hardware emulation.

### Host UI invariants

| Invariant | Meaning |
|---|---|
| Source always visible | Editor (or equivalent) remains on screen while the program runs |
| Source always editable | User can change `.b` / `.bas` text at any time |
| Picker-first loading | Built-in examples load from a simple picker; optional file open later |
| Minimal chrome | Picker + editor + run/stop + output/canvas — nothing else until needed |

---

## Strategy Choice

| Option | Verdict |
|---|---|
| Modify ACE C `gen_` backend; run compiler natively | Rejected for product path — not pure client-side |
| Compile ACE C → WASM once; emit JS in-browser | Possible, but **not lightweight** |
| **JS compiler + JS runtime**; use C ACE as a **spec** | **Chosen** |

The recursive-descent parser in vidarh’s ACE fork (and the original docs) are reverse-engineering sources for grammar and semantics. The shipped product does not include the C compiler.

Compiler **output** remains JavaScript (not WASM), for the reasons already logged in the design doc: DOM/API calls live in JS, debuggability, and ACE programs are not compute-bound.

---

## Sources of Truth

| Source | Role |
|---|---|
| [Programmer’s Guide v2.3](https://dbenn.github.io/docs/ace.html) | Language model, structure, how programs are written |
| [Language Reference v2.3](https://dbenn.github.io/docs/ref.html) | Commands/functions → runtime surface |
| [Reserved Words v2.3](https://dbenn.github.io/docs/rwords.html) | Lexer keyword set |
| [Doc index](https://dbenn.github.io/docs/doc_index.html) | Entry point for the above |
| [vidarh/ACE](https://github.com/vidarh/ACE) | Parser/codegen reference; `prgs/` examples as acceptance corpus |
| `docs/design_deac.md` | Architecture and UX intent |
| `.cursorrules` | Standing project guidance for agents |

When docs, examples, and C disagree on intent, **David Benn’s original semantics take precedence**.

---

## Proposed Repo Layout

Keep the tree small until something earns its place:

```text
docs/                 design + this plan
examples/             curated .b fixtures (ACE prgs/-style folders + ACEBasicJS/)
  ACEBasicJS/         host demos (hello, window, …)
  Turtle/ BenchMarks/ Gfx/ Sound/ Misc/ …
  manifest.json       picker entries with folder → <optgroup>
src/
  compiler/           lexer, parser, codegen → JS string
  runtime/            AmigaOS-ish API (console → intuition → gfx → audio → …)
  ui/                 picker + always-visible editor + run/stop + canvas
public/               static assets (Topaz later)
```

No C subtree in the default product path. Optional `vendor/ace-c/` only if needed as an offline reference checkout — not a build dependency for the browser app.

---

## Phases

### Phase 0 — Skeleton (now → next)

- Static page: **program picker** + **always-visible editable source** + Run/Stop + output area
- Picker loads a stub example into the editor (source stays visible after Run)
- Compiler/runtime stubs behind Compile/Run
- README points at design, plan, and ACE docs

**Done when:** opening the host page lets you pick a stub program, see and edit its source, and run a hard-coded path that prints via the runtime stub.

### Phase 1 — Spec harvest

- ~~Extract a construct checklist from the Programmer’s Guide + Language Reference~~ → [`docs/construct-checklist.md`](construct-checklist.md)
- ~~Seed `examples/` with a **tiny** ordered suite~~ → `hello`, `loops`, `sieve`, `ackermann` (see [`examples/README.md`](../examples/README.md))
- C `parse*.c` / `codegen.c` remain reference-only (not ported)

**Seed suite (actual):**

| Example | Why |
|---|---|
| `examples/ACEBasicJS/hello.b` | Phase 0 `PRINT` smoke test (vidarh `Library/hello.b` needs `LIBRARY dos` — deferred) |
| `examples/BenchMarks/loops.b` | Nested `FOR` / `WHILE` / `REPEAT`, `CONST`, `TIMER` |
| `examples/BenchMarks/sieve.b` | `DIM`, `IF`, `GOTO`, line numbers |
| `examples/BenchMarks/ackermann.b` | `SUB`, recursion, `EXIT SUB` |

**Done when:** ~~a written construct checklist exists and the seed examples are in-repo with expected-behaviour notes.~~

### Phase 2 — Minimal JS compiler

~~Subset grammar…~~ Implemented in `src/compiler/compiler.js` (structured codegen + linear/`GOTO` mode).

**Done when:** ~~seed logic examples compile to readable JS and execute in the browser with correct numeric/string results (no Intuition yet).~~

Verify: `node tests/phase2-smoke.js`

### Phase 3 — Console I/O runtime

~~`PRINT`, `INPUT` on a simple terminal surface~~ — `PRINT` separators/padding (Phase 2 follow-up) plus async `INPUT` with a host input row and `inputLines` for tests. Demo: `examples/input.b`.

**Done when:** ~~`hello.b` / `print.b`-class programs run end-to-end in-page.~~ ~~Interactive `INPUT` works in-page; smoke tests cover prompt / `? ` / comma forms.~~

Verify: `node tests/phase2-smoke.js` (includes INPUT cases).

### Phase 3.5 — Unified console / shell I/O (UX)

~~Closer to the Amiga CLI / shell experience…~~ One `#console` surface: `PRINT` into `#output`, live typing + blinking caret after the prompt, Enter submits; detached INPUT row removed. Headless `inputLines` / `provideInput` unchanged.

**Done when:** ~~`examples/input.b` feels like a single shell session; detached INPUT row gone.~~

**Why a half-step, not a full phase:** no new language constructs — only host UX. Done **before** Phase 4 Intuition so CLI-style programs stay authentic, and windowed I/O can later reuse the same “text in a surface” ideas.

### Phase 4 — Intuition basics + UX chrome

~~`WINDOW` / `SCREEN`, text in windows~~ — custom screen host in the Display panel, Amiga-style title-bar chrome (close / depth / drag), `PRINT` into the current window, close-gadget ≈ ACE `-w` (stops the program). Demo: `examples/window.b`.

**Done when:** ~~one small windowed example matches the Amiga UX intent closely enough to iterate.~~

Still deferred within Phase 4+: `MENU` / `GADGET`, full `PALETTE` / `COLOR` / `LOCATE`, RMB menus, Topaz webfont.

### Phase 4.5 — Unified INPUT in windows (UX)

~~Reuse the Phase 3.5 “text in a surface” pattern for Intuition~~ — when `INPUT` runs with a current window, live typing + blinking caret appear in that window (same as `PRINT`); Enter submits. CLI programs keep the console surface. Demo: `examples/window-input.b`.

**Done when:** ~~windowed `INPUT` feels like one text surface; no detached console typing required.~~

### Phase 5 — RastPort graphics

~~`LINE` / `PSET` / `CIRCLE` / `COLOR` / `PALETTE` / `CLS` / `LOCATE` / `POINT`~~ — indexed framebuffer per window (palette remaps like Amiga), canvas blit in the Display panel. Demo: `examples/graphics.b`.

**Done when:** ~~a small graphics example draws lines, boxes, and circles with a custom palette.~~

~~Phase 5+ follow-up:~~ `PAINT` / `AREA` / `AREAFILL` / `PATTERN` (+ `&H` hex literals) — flood fill, polygon fill, line/area patterns. Demo: `examples/Gfx/paint.b` (from vidarh `prgs/Gfx/pattern.b`).

Still deferred within graphics: `SCROLL`, IFF, EHB/HAM modes, Topaz webfont, `MENU` / `GADGET` (elevate when a Gfx/Turtle example needs them).

### Phase 5.5 — Math builtins (program-driven)

~~`RND` / `RANDOMIZE` / `INT` / `SQR` / `ABS` / `SIN` / `COS` / …~~ unlocked by climbing the vidarh corpus:

| Example | Features exercised |
|---|---|
| `examples/hi.b` | bare `RND`, `COLOR` fg/bg, coloured `LOCATE`/`PRINT` |
| `examples/ahl.b` | `SQR(n)`, `RND`, `ABS(n)` |
| `examples/lines.b` | `RANDOMIZE TIMER`, `INT`, `RND`, `LINE` |
| `examples/fact.b` | recursive `SUB` (already Phase 2) + interactive `INPUT` |

Also: single-line `WHILE cond:…:WEND`, and window `PRINT` as absolutely positioned coloured runs (so `hi.b` keeps per-string pens).

**Done when:** ~~hi / ahl / lines / fact compile and pass smoke checks.~~

### Phase 6 — SOUND / WAVE (Web Audio)

~~`SOUND` / `WAVE SIN` / `BEEP`~~ — Paula-style period (124..32767), duration 18.2 ≈ 1s, volume 0..64, voices 0..3. Frequency = `3579546 / (period * 32)` for ACE’s 32-byte sine table. Demo: `examples/Sound/sound.b`.

Still deferred: `WAVE` with `ALLOC`/`POKE` sample memory (white noise / 8SVX `play.b`), tracker modules.

**Done when:** ~~tones play in-page after Run (user gesture); smoke tests log SOUND calls.~~

### Phase 7+ — Reordered priority (post–SOUND)

Drive by visible demos and the smallest stack that works. Do **not** expand grammar ahead of a failing example.

| Priority | Work | Why / seed |
|---|---|---|
| **1** | **Turtle graphics** | ~~Thin layer on existing RastPort~~ — `FORWARD` / `BACK` / `TURN*` / `PEN*` / `SETXY` / `HOME` / `SETHEADING` / `HEADING` / `XCOR` / `YCOR`. Seeds: `examples/Turtle/{torus,flower,boxit}.b` (full Turtle/ set in picker). `bst` still needs STRUCT/ADDRESS; `spiro` MENU deferred |
| **2** | **Gfx corpus climb** | More of the original ACE graphics demos (vidarh `prgs/Gfx/`). `pattern.b` already landed as `examples/Gfx/paint.b`. Next easy wins before IFF/EHB/HAM: e.g. `pattern2.b` (needs `GADGET WAIT`), `7seg.b`, `shuttle.b`, `tri.b` — unlock constructs only as each fails |
| **3** | **SAY** | Web Speech API; seed `welcome.b` (`SAY TRANSLATE$(…)`). Full `SpeechTool.b` waits on `GADGET` / requesters |
| **4** | **`LIBRARY` selective shims** | `LIBRARY` open/close can be **no-ops**. `DECLARE FUNCTION … LIBRARY` must bind the few AmigaOS calls an example actually uses (e.g. `FPuts` → console). Not a blanket stub for every `.bmap` entry |
| **5** | **Sequential files (demoted)** | Client-side apps rarely need `PRINT#` persistence. When an example demands it (`seq.b`), use an **in-memory VFS** first. IndexedDB only if reload survival is wanted — optional, maybe never |
| later | GUI (`MENU`/`GADGET`), IFF/EHB/HAM, sample `WAVE`, tracker/`PLAY` | As corpus examples force them |

Each newly passing distribution example is a milestone.

---

## Acceptance Rule

A program **passes** when:

1. The **in-browser** JS compiler accepts its source, and
2. Behaviour in the JS runtime is equivalent to original ACE/Amiga execution for that program’s observable effects (output, drawing, sound, etc.).

The C compiler is a reference oracle during development, not the acceptance compiler.

---

## Explicit Non-Goals (near term)

- Full hardware emulation (UAE/WASM Amiga) — simulation of the OS API is the point
- Shipping the C ACE compiler (native or WASM) as the product compiler
- SPA frameworks, bundler mazes, or “platform” scaffolding without a concrete need
- Hide-the-source / run-only modes
- Joystick support
- Cycle-exact graphics/audio
- 100% Language Reference coverage before the seed suite passes

---

## Immediate Next Actions

1. ~~Expand `README.md`…~~
2. ~~Phase 0 host…~~
3. ~~Seed examples…~~
4. ~~Phase 1 construct checklist…~~
5. ~~Phase 2: JS compiler for seed suite (`hello` / `loops` / `sieve` / `ackermann`)~~
6. ~~Phase 3: console `INPUT` (async host prompt + smoke tests)~~
7. ~~Phase 3.5: unified console / shell I/O~~ (print + input on one surface; Amiga CLI feel)
8. ~~Phase 4: Intuition basics~~ (`WINDOW` / `SCREEN` + chrome; see `examples/window.b`)
9. ~~Phase 4.5: windowed `INPUT`~~ (same surface as `PRINT`; Enter submits; `examples/window-input.b`)
10. ~~Phase 5: RastPort graphics~~ (`LINE` / `CIRCLE` / `PSET` / `COLOR` / `PALETTE`; see `examples/graphics.b`)
10b. ~~Phase 5+: `PAINT` / `AREA` / `AREAFILL` / `PATTERN`~~ (see `examples/Gfx/paint.b`)
11. ~~Phase 5.5: math builtins~~ (`RND` / `RANDOMIZE` / `INT` / `SQR` / `ABS`; `hi.b` / `ahl.b` / `lines.b` / `fact.b`)
12. ~~Phase 6: SOUND / WAVE~~ (`WAVE SIN`, `SOUND`, `BEEP`; see `examples/Sound/sound.b`)
13. ~~**Turtle graphics**~~ — `FORWARD` / `TURN*` / `PEN*` / `SETXY`; `torus` / `flower` / `boxit`
14. **Gfx corpus climb** — more vidarh `prgs/Gfx/` beyond `paint.b` (defer IFF/EHB/HAM)
15. **SAY** — Web Speech; seed `welcome.b`
16. **`LIBRARY` shims** — open/close no-ops; bind only calls examples need
17. **Files (low priority)** — in-memory VFS if/when `seq.b`-class demos matter; IndexedDB optional

---

## References

- Design: [`docs/design_deac.md`](design_deac.md)
- Agent rules: [`.cursorrules`](../.cursorrules)
- ACE docs: https://dbenn.github.io/docs/doc_index.html
- Base fork / examples: https://github.com/vidarh/ACE
