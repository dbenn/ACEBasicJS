# ACEBasicJS

ACE Basic compiler and AmigaOS-inspired runtime that run **entirely in the browser** (JavaScript in, JavaScript out — no hardware emulation).

**Live:** https://dbenn.github.io/ACEBasicJS/ (after Pages is enabled and this lands on `main`)

## Try locally

From the repo root (a static server is required so the program picker can `fetch` examples):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/ — pick a program, edit the ACE source (always visible), Run.

Phase 2 compiles control flow, arrays/`GOTO`, and `SUB` recursion. Phase 3 adds interactive `INPUT` on a unified console. Phase 4 opens Amiga-style `SCREEN` / `WINDOW` chrome in the Display panel (try **WINDOW / SCREEN**). Phase 5 draws with `LINE` / `CIRCLE` / `PSET` (try **Graphics (LINE/CIRCLE)**).

## GitHub Pages

The site is static (`index.html` + `src/` + `examples/`). Deployment is via `.github/workflows/pages.yml` on every push to `main`.

One-time setup on GitHub:

1. Make the repo **public** (required for Pages on a free personal account), or ensure your plan allows Pages on private repos.
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. Merge to `main` (or run the “Deploy GitHub Pages” workflow manually).

Site URL: `https://dbenn.github.io/ACEBasicJS/`

## Docs

- Design: [`docs/design_deac.md`](docs/design_deac.md)
- Implementation plan: [`docs/implementation-plan.md`](docs/implementation-plan.md)
- Construct checklist (Phase 1): [`docs/construct-checklist.md`](docs/construct-checklist.md)
- Seed expectations: [`examples/README.md`](examples/README.md)
- Feature demos (screenshots / videos): [`demos/`](demos/)
- ACE docs (v2.3): https://dbenn.github.io/docs/doc_index.html
- Reference fork / examples: https://github.com/vidarh/ACE
