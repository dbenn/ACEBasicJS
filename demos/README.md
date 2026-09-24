# Feature demos

Screenshots and short screen recordings of features as they land.
Keep media small and descriptive; prefer one short video plus 1–2 stills per phase/feature.

| Path | Feature |
|---|---|
| [`phase0/`](phase0/) | Host UI: picker, always-visible source, Run → `PRINT` |
| [`phase3/`](phase3/) | Interactive `INPUT` (early: prompt row under Output) |
| [`phase35/`](phase35/) | Unified console: in-place `INPUT` + caret (Amiga CLI feel) |
| [`phase4/`](phase4/) | Intuition `SCREEN` / `WINDOW` chrome + PRINT-to-window |
| [`phase45/`](phase45/) | `INPUT` in-window (same surface as `PRINT`; Enter submits) |
| [`phase45-inline/`](phase45-inline/) | Window INPUT draft inline at prompt (not bottom) |
| [`phase5/`](phase5/) | RastPort `LINE` / `CIRCLE` / `PSET` / `PALETTE` |
| [`phase5-paint/`](phase5-paint/) | `PAINT` / `AREA` / `AREAFILL` / `PATTERN` |
| [`phase55/`](phase55/) | Math builtins: `RND` / `COLOR` text (`hi.b`), `lines.b` |
| [`phase6/`](phase6/) | `SOUND` / `WAVE SIN` / `BEEP` (Web Audio) |
| [`phase7-turtle/`](phase7-turtle/) | Turtle `FORWARD` / `TURN*` / `PEN*` / `SETXY` |

## Convention

When a phase or user-visible feature is implemented and manually verified:

1. Save a short recording and/or key stills under `demos/<phase-or-feature>/`
2. Use kebab-case names that describe the content (`input-demo.mp4`, `input-complete.webp`)
3. Mention new demos in the PR description
4. Prefer WebP/PNG for stills; keep videos short and under ~20 MB when practical
