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
examples/             curated .b fixtures for the program picker
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
| `examples/hello.b` | Phase 0 `PRINT` smoke test (vidarh `Library/hello.b` needs `LIBRARY dos` — deferred) |
| `examples/loops.b` | Nested `FOR` / `WHILE` / `REPEAT`, `CONST`, `TIMER` |
| `examples/sieve.b` | `DIM`, `IF`, `GOTO`, line numbers |
| `examples/ackermann.b` | `SUB`, recursion, `EXIT SUB` |

**Done when:** ~~a written construct checklist exists and the seed examples are in-repo with expected-behaviour notes.~~

### Phase 2 — Minimal JS compiler

Subset grammar, hand-written recursive descent (mirroring ACE’s shape, not its C):

- Program structure, statements, expressions
- Variables / simple types as needed by the seed examples
- Control flow: `IF`/`THEN`/`ELSE`, `FOR`/`NEXT`, `WHILE`/`WEND`, `REPEAT`/`UNTIL`
- `GOTO` + line numbers as required by `sieve.b`
- `SUB` + call / return / `EXIT SUB` as required by `ackermann.b`
- Codegen emits plain JS calling `runtime.*`

Follow the ordered Phase 2 entry criteria in [`construct-checklist.md`](construct-checklist.md).

**Done when:** seed logic examples compile to readable JS and execute in the browser with correct numeric/string results (no Intuition yet).

### Phase 3 — Console I/O runtime

- `PRINT`, `INPUT` on a simple terminal surface (canvas or DOM pre)
- Enough to replace hard-coded expected output checks with interactive demos

**Done when:** `hello.b` / `print.b`-class programs run end-to-end in-page.

### Phase 4 — Intuition basics + UX chrome

- `WINDOW` / `SCREEN`, text in windows
- Topaz, Workbench palette, title-bar chrome, RMB menus (as needed by chosen GUI examples)

**Done when:** one small windowed example matches the Amiga UX intent closely enough to iterate.

### Phase 5+ — Graphics, audio, speech, files, corpus climb

Follow the ordering in `design_deac.md` (RastPort → SOUND/WAVE/PLAY → SAY → sequential files via IndexedDB), unlocking vidarh `prgs/Gfx`, `GUI`, `IO`, etc. one example at a time.

Each newly passing distribution example is a milestone; do not expand the grammar ahead of failing examples.

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

1. ~~Expand `README.md` with project one-liner + links to design, this plan, and ACE docs~~
2. ~~Add Phase 0 host page: picker + always-visible editor + stub `src/compiler` / `src/runtime`~~
3. ~~Seed `examples/` for the picker (`hello.b` + vidarh benchmarks)~~
4. ~~Phase 1 construct checklist + expected-behaviour notes~~
5. Phase 2: grow the JS compiler past `PRINT "..."` toward `loops.b` / control flow (see checklist entry criteria)

---

## References

- Design: [`docs/design_deac.md`](design_deac.md)
- Agent rules: [`.cursorrules`](../.cursorrules)
- ACE docs: https://dbenn.github.io/docs/doc_index.html
- Base fork / examples: https://github.com/vidarh/ACE
