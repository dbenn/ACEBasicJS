# Seed examples — expected behaviour

Curated fixtures for the program picker. Sources: local Phase 0 seed plus
[vidarh/ACE](https://github.com/vidarh/ACE) `prgs/` benchmarks.

Phase 0 only runs simple `PRINT "..."` lines. Later phases must meet the
expectations below (observable results in the host output / runtime).

| Id | File | Origin | Why it is here | Expected when supported |
|---|---|---|---|---|
| `hello` | `hello.b` | ACEBasicJS Phase 0 | Trivial `PRINT` smoke test | Two lines: `Hello from ACEBasicJS` then `Edit me, then Run again.` |
| `input` | `input.b` | ACEBasicJS Phase 3 | Interactive `INPUT` (prompt + `? `, string and number) | Asks for name then number; echoes greeting and double. Enter answers in the INPUT row under Output. |
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
- Node smoke tests feed `INPUT` via `inputLines` on the runtime; the browser uses the OUTPUT panel’s INPUT row (Enter to submit).
