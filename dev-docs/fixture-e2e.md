# Fixture Product E2E — scenario guide

How to write Fixture Product E2E scenarios. `AGENTS.md` decides *which* layer owns a test; this file is for when the answer is Fixture Product E2E.

| Lives in | What |
| --- | --- |
| `tests/e2e/fixture-*.spec.ts` | Scenarios grouped by risk |
| `tests/e2e/fixtureHarness.ts` | Fixture extractor, local media server, deny proxy, diagnostics |
| `src/main/e2eHarness.ts` | `ARROXY_E2E` / `ARROXY_E2E_HEADLESS` app-side switches |

## Scenario design

Do not create one giant "everything" E2E scenario. Group product E2E by risk case so failures are local and useful:

- **Bulk input**: real clipboard paste, messy lists, invalid lines, duplicates, large lists.
- **Metadata fetching**: concurrency limits, slow probes, partial failure, late thumbnails/subtitles, user navigation while probes are still running.
- **Wizard navigation**: back/next while state is incomplete, skipped steps, preserved output/format choices.
- **Queue controls**: active downloads, priority, pause item, resume item, cancel item, pause all, resume all.
- **Failure and recovery**: failed metadata, failed media, subtitle soft failure, retry, cancel during slow stream.
- **Persistence and restart**: pending queue, paused active item, restored output folder, completed/cancelled lifecycle after app restart.
- **Scale and UX stress**: many URLs, long titles, drawer scrolling, progress churn, layout stability.

For each risk group, add Fixture Product E2E only for behavior that needs real app wiring or realistic user interaction. Keep pure rules and local UI states in lower layers. Each Fixture Product E2E scenario should declare:

1. The user-facing risk being tested.
2. The fixture videos, delays, failures, and output directory.
3. The real user actions, preferably via mouse, keyboard, and OS clipboard.
4. The milestones that prove each workflow phase completed.
5. The final oracles: visible UI state, E2E diagnostics when needed, filesystem outputs, and deny-proxy request log.

## Workflow feedback rules

- Prefer visible UI milestones first: title appears, row count changes, progress/status changes, buttons enable/disable, queue card reaches the expected state.
- Use E2E-only diagnostics only when visible UI is insufficient. Gate diagnostics behind `ARROXY_E2E=1`; never expose them in normal packaged production.
- Use filesystem assertions for download outcomes. A completed queue item is not enough if the expected output file is missing or implausible.
- Use the deny proxy request log as an oracle. Deterministic fixture tests must fail if yt-dlp reaches non-local network.
- Avoid hardcoded sleeps. Wait for specific UI, diagnostic, process, filesystem, or network milestones.
- Capture screenshots/traces for complex scenario failures so an agent can inspect what a human would have seen.

## Anti-patterns

- Do not add unit tests to claim a real paste -> metadata -> queue -> download workflow is fixed.
- Do not duplicate the same acceptance behavior in unit, jsdom, browser-mock, and fixture E2E layers.
- Do not treat browser-mock as proof that real IPC, yt-dlp, queue scheduling, or filesystem behavior works.
- Do not use fake yt-dlp as the normal download acceptance strategy. Keep fake yt-dlp only for process-supervision failures such as spawn failure, permission denied, crash, invalid JSON, huge stderr, hang, and signal termination.
- Do not make one super scenario that covers every risk at once. Prefer grouped, realistic scenarios with clear ownership.
