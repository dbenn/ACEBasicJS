# ACEBasicJS

ACE Basic compiler and AmigaOS-inspired runtime that run **entirely in the browser** (JavaScript in, JavaScript out — no hardware emulation).

## Try Phase 0

From the repo root (a static server is required so the program picker can `fetch` examples):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/ — pick a program, edit the ACE source (always visible), Run.

Phase 0 only executes simple `PRINT "..."` lines; other ACE constructs are reported in the output until later phases.

## Docs

- Design: [`docs/design_deac.md`](docs/design_deac.md)
- Implementation plan: [`docs/implementation-plan.md`](docs/implementation-plan.md)
- ACE docs (v2.3): https://dbenn.github.io/docs/doc_index.html
- Reference fork / examples: https://github.com/vidarh/ACE
