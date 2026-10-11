---
name: readme-edits-skip-pr
description: README-only wording/layout edits go straight to main — no branch, no PR, no CodeRabbit.
metadata:
  type: feedback
---

A README-only change (readme-src template/locales plus the regenerated `README*.md`) is committed and pushed straight to `main`. Antonio: "for readme dont need a pr, too small to bother" (2026-10-11, after a README trim was opened as PR #249).

**Why:** a docs edit doesn't need CodeRabbit or a 20-minute CI round, and README text ships from GitHub, not with the app.

**How to apply:** still run `bun run check` (the README build enforces locale key parity) and the no-attribution greps, then push to `main`. Code, scripts and workflows still go through a PR per [[finish-before-pr]] and the ship-fix flow. If a release tag is waiting on `main`'s required checks, tag first: a new commit on `main` restarts that wait.
