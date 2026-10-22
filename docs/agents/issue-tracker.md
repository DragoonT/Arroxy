# Issue tracker: GitHub

Arroxy's issues live on GitHub at `antonio-orionus/Arroxy`. Use the `gh` CLI on the `antonio-orionus` account. Labels and what they mean: [triage-labels.md](triage-labels.md).

## Conventions

- **Create an issue**: `gh issue create --label <kind> --label <state> --title "..." --body-file <file>`.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,labels` with `--label` filters; what an agent can take now is `--label ready-for-agent`.
- **Comment**: `gh issue comment <number> --body-file <file>`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: a PR closes the issues it fixes with one `Fixes #N` line each; close by hand only for `wontfix` or `duplicate`, with a comment saying why.

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are reviewed as PRs, not triaged as issues.

## What gets an issue

Issues are public. An issue is filed for a user-visible bug, a real test gap, or code-health work too big for the PR at hand. A small problem in the area a PR already changes is fixed in that PR instead, and a spec or test that a PR made outdated is updated in that PR. Formatting and style nits never get one.

Plans, research, strategy and the feature backlog stay private, in the maintainer's `.internal/` notes, never in an issue.

## When a skill says "publish to the issue tracker"

Create a GitHub issue as above, if it passes "What gets an issue"; otherwise report it.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.
