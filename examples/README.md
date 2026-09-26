# Seed examples — expected behaviour

Curated fixtures for the program picker. Folder layout mirrors the original ACE
2.4 [`prgs/`](https://github.com/dbenn/ACE) tree so the dropdown shows
**optgroups** (`Turtle`, `BenchMarks`, `Gfx`, …). The `.b` demos themselves are
**David Benn’s** programs from that distribution (not third-party). Host-only
demos live under `ACEBasicJS/`. ACE root-level programs (e.g. `hi.b`) use the
`prgs` group.

Phase 0 only runs simple `PRINT "..."` lines. Later phases must meet the
expectations below (observable results in the host output / runtime).

## Folder map

| Folder | Author / origin | Contents |
|---|---|---|
| `ACEBasicJS/` | This project | `hello`, `input`, `window`, `window-input`, `graphics` |
| `BenchMarks/` | David Benn — original ACE `prgs/BenchMarks/` | `Ackermann`, `Ahl`, `lines`, `loops`, `sieve` |
| `Gfx/` | David Benn — original ACE `prgs/Gfx/` | `paint` (from `pattern.b`) |
| `Misc/` | David Benn — original ACE `prgs/Misc/` | `fact` |
| `prgs` (group) | David Benn — original ACE `prgs/*.b` | `hi` (`examples/hi.b`) |
| `Sound/` | David Benn — original ACE `prgs/Sound/` | `sound` |
| `Turtle/` | David Benn — original ACE `prgs/Turtle/` | **all** TG demos: `boxit`, `bst`, `dragon`, `flower`, `snowflake`, `spiro`, `torus`, `tree` |

## Programs

| Id | Path | Expected when supported |
|---|---|---|
| `hello` | `ACEBasicJS/hello.b` | Two lines: `Hello from ACEBasicJS` then `Edit me, then Run again.` |
| `input` | `ACEBasicJS/input.b` | Asks for name then number; echoes greeting and double (console Enter). |
| `window` | `ACEBasicJS/window.b` | 320×200 screen + titled window; close gadget (or Stop) quits. |
| `window-input` | `ACEBasicJS/window-input.b` | Type in the window after prompts; Enter submits. |
| `graphics` | `ACEBasicJS/graphics.b` | Lines, boxes, circles; wait for a key or close. |
| `ackermann` | `BenchMarks/ackermann.b` | Ackermann table via recursive `SUB`. |
| `ahl` | `BenchMarks/ahl.b` | Time / accuracy / random accumulator lines. |
| `lines` | `BenchMarks/lines.b` | Random lines; press a key when done. |
| `loops` | `BenchMarks/loops.b` | Timing lines for FOR / WHILE / REPEAT. |
| `sieve` | `BenchMarks/sieve.b` | Byte sieve banner + timing. |
| `paint` | `Gfx/paint.b` | Patterned triangle, flood-filled circle, solid boxes. |
| `fact` | `Misc/fact.b` | Factorials until `-1`. |
| `hi` | `hi.b` | Coloured "Hi There!" spray; press `q`. |
| `sound` | `Sound/sound.b` | Tones / period sweep (unmute tab). |
| `boxit` | `Turtle/boxit.b` | Recursive boxed edges; press `q`. |
| `bst` | `Turtle/bst.b` | **Deferred** — STRUCT / ADDRESS / CASE / ALLOC / … (after Gfx climb; not a turtle gate). |
| `dragon` | `Turtle/dragon.b` | Dragon curve; prompts for depth/sides. |
| `flower` | `Turtle/flower.b` | Flower; press `q`. |
| `snowflake` | `Turtle/snowflake.b` | Koch snowflake; prompts for depth/sides. |
| `spiro` | `Turtle/spiro.b` | SpiroGraph; press `q` (original `MENU` deferred). |
| `torus` | `Turtle/torus.b` | Nested turtle loops; press a key or close. |
| `tree` | `Turtle/tree.b` | Recursive tree; prompt is **branch length in pixels** (try **40**, not 5 — base case is `n<5`); press `q`. |

## Intentionally not seeded yet

| Program | Reason |
|---|---|
| ACE `prgs/Gfx/*` (beyond `paint.b`) | Next after async SUBs / `spiro`; defer IFF/EHB/HAM |
| `Turtle/bst.b` language stack | Deferred — STRUCT/pointer phase after Gfx; keep file in picker |
| ACE `prgs/welcome.b` | Needs `SAY` / `TRANSLATE$` |
| ACE `prgs/Library/hello.b` | `LIBRARY` selective shims later |
| ACE `prgs/IO/seq.b` | File I/O demoted |

## Notes

- Comments starting with `'..` or `REM` are ignored.
- Node smoke tests feed `INPUT` via `inputLines` on the runtime; the browser types on the active text surface (console or current window) and presses Enter to submit.
- Phase 4 Intuition programs draw into the Display panel’s screen host; CLI programs still use the console surface below.
- Browser ports of tight Amiga wait loops add `SLEEP` so the event loop can deliver keys.
- `manifest.json` `folder` field drives `<optgroup>` labels in the program picker.
