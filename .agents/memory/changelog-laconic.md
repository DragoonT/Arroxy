---
name: changelog-laconic
description: CHANGELOG.md entries are short and user-facing — one or two sentences on what the user sees, no internals, no exact sizes.
metadata:
  type: feedback
---

Write every `CHANGELOG.md` entry so a user actually reads it:

- One or two short sentences. A highlight is a bold lead-in plus one or two sentences, nothing more.
- Say what the user sees or gets, in the app's own UI words (**Try now**, **Set it up manually**). Leave out how it works: no internal names, error codes, flags, timeouts or step-by-step behaviour.
- No specific numbers for sizes ("smaller download", not "50 MB smaller"); they change with every package and nobody checks them.
- Skip refactors, tests, docs, log-only changes and polish of features new in the same release.

**Why:** The 0.7.0 draft (2026-10-19) grew to multi-sentence entries listing every rule and number; the user had the whole section, older entries included, cut to one or two sentences each: the more text, the less people read.

**How to apply:** Whenever adding or editing a release section in `CHANGELOG.md` (including the "release X" flow in `AGENTS.md`), draft in this style and shorten any existing entry in that section that breaks it.
