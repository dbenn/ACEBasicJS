# Seed examples — expected behaviour

Curated fixtures for the program picker. Sources: local Phase 0 seed plus
[vidarh/ACE](https://github.com/vidarh/ACE) `prgs/` benchmarks.

Phase 0 only runs simple `PRINT "..."` lines. Later phases must meet the
expectations below (observable results in the host output / runtime).

| Id | File | Origin | Why it is here | Expected when supported |
|---|---|---|---|---|
| `hello` | `hello.b` | ACEBasicJS Phase 0 | Trivial `PRINT` smoke test | Two lines: `Hello from ACEBasicJS` then `Edit me, then Run again.` |
| `hi` | `hi.b` | vidarh `prgs/hi.b` | `RND`, `COLOR` fg/bg, `LOCATE`, window text | Coloured "Hi There!" spray; press `q` (or Stop) to quit. |
| `window` | `window.b` | ACEBasicJS Phase 4 | `SCREEN` / `WINDOW` chrome + `PRINT` into window | Opens a 320×200 screen and titled window; text appears in the window. Close gadget (or Stop) ends the wait loop. |
| `window-input` | `window-input.b` | ACEBasicJS Phase 4.5 | `INPUT` on the same window surface as `PRINT` | Prompts in the window; type after the prompt, Enter to submit; echoes greeting and double. |
| `graphics` | `graphics.b` | ACEBasicJS Phase 5 | RastPort `LINE` / `CIRCLE` / `PSET` / `COLOR` / `PALETTE` / `LOCATE` | Opens a 320×200 screen; draws lines, boxes, circles; wait for a key or close. |
| `lines` | `lines.b` | vidarh `prgs/BenchMarks/lines.b` | `RANDOMIZE`, `RND`, `INT` + `LINE` | Draws random lines; prints elapsed seconds; press a key to quit. |
| `input` | `input.b` | ACEBasicJS Phase 3 | Interactive `INPUT` (prompt + `? `, string and number) | Asks for name then number; echoes greeting and double. Type in the unified console (Enter to submit). |
| `fact` | `fact.b` | vidarh `prgs/Misc/fact.b` | Recursive `SUB` + console `INPUT` | Prompts for integers; prints factorials until `-1`. |
| `ahl` | `ahl.b` | vidarh `prgs/BenchMarks/Ahl.b` | `SQR` / `RND` / `ABS` builtins | Prints time, accuracy, and random accumulator lines. |
| `loops` | `loops.b` | vidarh `prgs/BenchMarks/loops.b` | Nested `FOR`, `WHILE`, `REPEAT` / `UNTIL`, `CONST`, `TIMER` | Prints timing lines for FOR / WHILE / REPEAT (five passes). Exact seconds may differ; structure and labels matter. |
| `sieve` | `sieve.b` | vidarh `prgs/BenchMarks/sieve.b` | `DIM`, `FOR`, `IF`, `GOTO`, line numbers | Banner about byte sieve; runs five passes over flags; prints timing. |
| `ackermann` | `ackermann.b` | vidarh `prgs/BenchMarks/Ackermann.b` | `SUB`, recursion, `EXIT SUB`, return via name | Computes Ackermann values for the printed table; recursive depth must work. |

## Intentionally not seeded yet

| Program | Reason |
|---|---|
| vidarh `prgs/Library/hello.b` | Needs `LIBRARY dos` / `DECLARE FUNCTION` — later |
| vidarh `prgs/IO/print.b` | Printer + SUBmods / Workbench args — not a PRINT demo |

## Notes

- Comments starting with `'..` or `REM` are ignored.
- Node smoke tests feed `INPUT` via `inputLines` on the runtime; the browser types on the active text surface (console or current window) and presses Enter to submit.
- Phase 4 Intuition programs draw into the Display panel’s screen host; CLI programs still use the console surface below.
- Browser ports of tight Amiga wait loops add `SLEEP` so the event loop can deliver keys.
