# ACE-in-Browser: Design Document

*David Benn, 2025–*

---

## Background

ACE (Amiga BASIC compiler with extras) was written by David Benn between November
1991 and September 1996, and released as open source under the GPL in October 1998.
It is a recursive descent, peephole-optimising compiler for a large subset of
AmigaBASIC, extended with structured programming constructs, direct AmigaOS library
access, and various features not found in the original interpreter. It compiles
BASIC source to Motorola 68000 assembly, which is then assembled and linked into
a native Amiga executable.

Thirty years on, ACE-in-Browser is a project to bring ACE programs to life in a
modern web browser — authored by the original creator of ACE, with full knowledge
of its internals.

---

## The Central Idea

The naive approach to running Amiga software in a browser is full hardware
emulation: recreate the 68000 CPU, the custom chips (Agnus, Denise, Paula), the
Kickstart ROM, and run native binaries unchanged. This works — UAE has been
compiled to WebAssembly — but it is a large, complex undertaking and produces a
somewhat alien experience (you're running an OS inside a browser tab).

ACE-in-Browser takes a different approach entirely. Because ACE programs were
written against the **AmigaOS API** — Intuition for windowing, Graphics.library
for drawing, Paula for audio, AmigaDOS for files — rather than directly against
the custom chip registers, the hardware layer is largely irrelevant. What matters
is faithfully reimplementing the OS API surface that ACE programs actually called.

The strategy is therefore:

1. **Modify ACE's compiler backend** to emit JavaScript instead of 68000 assembly
2. **Build a JavaScript runtime** that implements the AmigaOS API surface ACE programs used
3. **Preserve the Amiga UX** — Topaz font, Workbench window chrome, right-mouse menus — so programs feel authentic

The result is not emulation. It is a new native target for ACE, with the browser
as the platform and the DOM as the OS.

---

## Why This Approach Works for ACE Specifically

ACE programs used:

- **Intuition** — windows, screens, gadgets, menus, requesters
- **Graphics.library** — BitMap operations, RastPort drawing
- **Paula** — sample playback, tracker music
- **Speech** — the SAY command via the Amiga's narrator.device
- **AmigaDOS** — sequential file I/O, directories
- **ACE's own runtime library** — strings, math, startup/shutdown

Conspicuously absent: bobs, sprites, copper lists, blitter timing, cycle-exact
anything. ACE programs lived at the OS level, not the hardware level. This makes
the API surface bounded and well-defined — exactly the right conditions for a
clean reimplementation.

---

## Compiler Architecture

### Starting Point

The original ACE 2.4 sources and example programs (`prgs/`) are at
https://github.com/dbenn/ACE (David Benn, 1992–1996). The `prgs/` demos were
**written by David Benn** for that distribution and are the acceptance corpus
here — do not attribute them to later forks.

[vidarh's Linux fork](https://github.com/vidarh/ACE) ported ACE to compile and
run on Linux (it still targets M68k output) and did some retargeting groundwork
in `codegen.c|h` with a view to eventual x86 support. That fork is useful as a
parser/codegen reference only; preserving `prgs/` there does not change
authorship of those programs.

The original ACE source was written before object-oriented design was well
understood by the author — it is a recursive descent parser with code generation
interleaved throughout. However, `codegen.c` and `codegen.h` provide a defined
set of `gen_` functions that the parser calls at code generation points. This is
the seam at which the JS backend is inserted.

### The JS Backend

The JS backend is implemented by replacing (or augmenting) the `gen_` function
implementations to emit JavaScript source text rather than 68000 assembly mnemonics.

The gen_ functions fall into a natural taxonomy:

**68k housekeeping**
Register assignment, stack frame setup, calling convention scaffolding. In a JS
backend these are largely or entirely no-ops — JavaScript manages its own memory
and call stack, and has no concept of register allocation.

**Control flow**
FOR/NEXT, WHILE/WEND, IF/THEN/ELSE, GOTO, GOSUB, ON/GOTO. These map to
equivalent JavaScript control flow constructs. GOTO and GOSUB require some care
(JavaScript has no goto) but can be handled with labelled loops or a dispatch
table for the cases that matter in practice.

**AmigaOS API calls**
WINDOW, SCREEN, PRINT, PLAY, WAVE, SOUND, SAY, and the full range of Intuition
and Graphics calls. These map to calls into the JavaScript runtime layer. This is
where the interesting work lives.

**I/O and string operations**
File I/O (OPEN, CLOSE, INPUT#, PRINT#, WRITE#), string functions, console I/O.
These map to JavaScript string handling and IndexedDB for persistence.

### Output Format: JavaScript, Not WebAssembly

An early design question was whether to target WebAssembly rather than JavaScript.
The answer is clearly JavaScript, for these reasons:

- Every AmigaOS API call (Intuition windows, Canvas drawing, Web Audio) lives in
  JavaScript-land. WebAssembly cannot call these directly — it requires JavaScript
  glue for every such call. Since the glue is mandatory anyway, the compiler output
  may as well be JavaScript too.
- JavaScript output is readable and debuggable in browser developer tools.
  WebAssembly is not. During development this matters enormously.
- ACE programs are not computationally intensive by modern standards. A 1990s
  Amiga program running in a modern browser has vast performance headroom in
  pure JavaScript.
- The result is a single-language stack: compiler output and runtime are both
  JavaScript, with no WASM/JS boundary to reason about.

---

## The JavaScript Runtime

The runtime reimplements the AmigaOS API surface as a JavaScript library. Each
major subsystem maps to a browser technology:

### Intuition → Canvas 2D

Windows are rendered on an HTML Canvas element with authentic Amiga window chrome:
Topaz font title bars, close/depth/resize gadgets in Workbench style, correct
colour palette. Multiple screens with independent properties are supported.
Right-mouse-button activates menus in Amiga style.

### Graphics.library → Canvas 2D API

RastPort drawing operations (lines, rectangles, circles, flood fill, text),
BitMap management, and colour palette handling map naturally to Canvas 2D
drawing primitives.

### Paula → Web Audio API

Four-channel sample playback with period/volume control maps to Web Audio
AudioBufferSourceNode instances. Tracker/module music uses the same mechanism.
The SOUND and WAVE commands are implemented here.

### Speech → Web Speech API

The SAY command maps to the browser's SpeechSynthesis API. Amiga-style voice
parameters (pitch, rate) are approximated using SpeechSynthesisUtterance
properties.

### AmigaDOS → IndexedDB + JavaScript

Sequential file I/O (the file operations ACE programs actually used) is
implemented over IndexedDB for persistence. Directory operations and environment
variables are handled in JavaScript.

### ACE Runtime Library

The functionality of `db.lib` and `ami.lib` — startup/shutdown scaffolding, string
handling, math functions, type coercion — is reimplemented in JavaScript, with
semantics faithful to ACE's original behaviour.

---

## The Amiga UX

A program that runs correctly but looks nothing like an Amiga is only half the
point. The runtime goes out of its way to reproduce the Amiga experience:

- **Topaz font** — the iconic Amiga system font, recreated as a web font
- **Workbench colour palette** — the blue, grey and orange of Workbench 1.3/2.0
- **Window chrome** — title bars, gadgets, and drag behaviour faithful to Intuition
- **Right-mouse-button menus** — the distinctly Amiga menu interaction model
- **Screen behaviour** — multiple screens, Workbench-style depth arrangement

Input devices in scope: keyboard and mouse. Joystick support is out of scope.

---

## Acceptance Criteria

The ACE distribution includes example programs that exercise the language and
runtime features. These serve as the primary acceptance test suite. A program
passes when it compiles via the modified ACE compiler and runs in the browser
with behaviour equivalent to the original Amiga execution.

---

## Development Phases

### Phase 1 — gen_ Taxonomy
Catalogue every `gen_` function in `codegen.c`. Classify each into the four
categories (68k housekeeping, control flow, AmigaOS API, I/O). This produces a
concrete scope for the JS backend and identifies which functions are no-ops.

### Phase 2 — JS Backend Skeleton
Implement `codegen_js.c` with stubs for all gen_ functions. Confirm the compiler
builds and produces JavaScript scaffolding for a trivial program.

### Phase 3 — Control Flow
FOR/NEXT, WHILE/WEND, IF/THEN/ELSE, GOSUB/RETURN. Get a non-trivial pure-logic
program running in the browser with no OS calls.

### Phase 4 — Console I/O
PRINT and INPUT working in a simple terminal surface. Enough to run classic
"Hello, World" and input-driven examples. Prefer a **unified console** (output and
typed input on the same shell-like surface) over a detached input field — closer
to Amiga CLI / shell behaviour; see implementation-plan Phase 3.5.

### Phase 5 — Intuition Basics
WINDOW, SCREEN, basic text output in windows. The Amiga UX becomes visible here
for the first time.

### Phase 6 — Graphics
RastPort drawing operations, BitMap handling, colour palettes.

### Phase 7 — Audio
SOUND, WAVE, PLAY commands via Web Audio API.

### Phase 8 — Turtle + Gfx corpus (priority)
Turtle graphics (`FORWARD` / `TURN*` / `PEN*` / `SETXY` / …) are in, including
`spiro` (async SUB codegen; MENU→`q`). Next: climb original ACE `prgs/Gfx/` demos.
Prefer visible, small examples; defer IFF / EHB / HAM until forced.
**Defer `Turtle/bst.b`** (STRUCT / ADDRESS / pointer stack) — it is a
data-structures demo that uses turtle for display, not a turtle-graphics gate.

### Phase 9 — Speech
SAY command via Web Speech API.

### Phase 10 — Libraries & files (as needed)
`LIBRARY` open/close may be no-ops; bind only the AmigaOS calls examples use.
Sequential file I/O only when demos need it — in-memory VFS first; IndexedDB
optional.

### Phase 11 — Further examples
Work through remaining ACE distribution examples systematically. Each passing
example is a milestone.

---

## References

- Original ACE documentation: https://dbenn.github.io/docs/projects.html#ace
- ACE v2.3 Programmer's Guide: http://www.users.on.net/~dbenn/docs/ace.html
- Original ACE 2.4 (source + `prgs/` examples): https://github.com/dbenn/ACE
- vidarh's Linux fork (parser/codegen notes): https://github.com/vidarh/ACE
- mdbergmann's ACEBasic (ACE 3.0 fork, for reference): https://github.com/mdbergmann/ACEBasic
