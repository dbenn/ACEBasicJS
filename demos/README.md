# Feature demos

Screenshots and short screen recordings of features as they land.
Keep media small and descriptive; prefer one short video plus 1–2 stills per phase/feature.

| Path | Feature |
|---|---|
| [`phase0/`](phase0/) | Host UI: picker, always-visible source, Run → `PRINT` |
| [`phase3/`](phase3/) | Interactive `INPUT` (early: prompt row under Output) |
| [`phase35/`](phase35/) | Unified console: in-place `INPUT` + caret (Amiga CLI feel) |
| [`phase4/`](phase4/) | Intuition `SCREEN` / `WINDOW` chrome + PRINT-to-window |

## Convention

When a phase or user-visible feature is implemented and manually verified:

1. Save a short recording and/or key stills under `demos/<phase-or-feature>/`
2. Use kebab-case names that describe the content (`input-demo.mp4`, `input-complete.webp`)
3. Mention new demos in the PR description
4. Prefer WebP/PNG for stills; keep videos short and under ~20 MB when practical
