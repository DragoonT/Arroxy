# In-App Browser (Explore) Spec

Status: design approved in discussion 2026-10-13 — awaiting spec review, then implementation plan
Updated: 2026-10-13 (cross-platform spike, cookie-freshness experiment, design decisions D1–D5)

Research and rationale: [`YOUTUBE-AUTH-RESEARCH.md`](../YOUTUBE-AUTH-RESEARCH.md).
**Read §2 and §6a before touching any of this.** The user-agent rule is
counter-intuitive and trivially broken by a well-meaning edit.

## Lives in

| Path | Role |
|---|---|
| `src/main/services/ExploreSessionService.ts` | **new** — owns the Explore partition, UA, cookie reads, signed-in check |
| `src/main/services/netscapeCookieJar.ts` | **new** — pure `Cookie[]` → Netscape text |
| `src/main/services/exploreEscalation.ts` | **new** — pure: which `YtDlpErrorKind`s escalate a job to the Explore session (D1) |
| `src/shared/sites/types.ts`, `src/shared/sites/youtube.ts` | `Site.explore` capability: home URL, allowed hosts, cookie domains, signed-in rule (D5) |
| `src/main/services/cookiesResolver.ts` | gains the `session` kind; Legacy branches untouched |
| `src/main/services/YtDlp.ts` | `cookiesArgs` construction; per-spawn temp-jar lifetime in `invokeOnce`; `auth` run option |
| `src/main/services/ProbeService.ts`, `src/main/services/phases/VideoPhase.ts` | escalation points; escalated jobs bypass `CookielessRetry` (D1, D4) |
| `src/main/token/providers/HiddenWindowTokenProvider.ts` | existing UA bug to fix; authenticated minting |
| `src/shared/schemas.ts` | `jobAuthSchema`, new `common` fields, queue-item `auth` field |
| `src/shared/ipc.ts` | `explore:*` channels |
| `src/renderer/src/components/wizard/DownloadProfilesHome.tsx` | the **existing** tab bar (`URL | Downloads | Profiles | Settings`) — Explore is added as one more tab |
| `electron-builder.json5` | `EnableCookieEncryption` fuse |
| `design/in-app-browser/` | mockups — `Main.dc.html` chosen, `MinWindow.dc.html` the 720x680 floor. **Gitignored (`/design/`), so local-only** — the layout decisions are restated in [UI](#ui) rather than left solely to those files |

## Goal

Add an **Explore** tab: an embedded browser where the user browses YouTube,
optionally signs in, and grabs what they find into the download flow. When a
download needs an account — sign-in required, age-restricted, or a bot wall —
Arroxy uses the Explore session's cookies for that job. This removes manual
cookie export and browser-picking, and fixes the "my cookies stopped working"
problem by construction (see *Cookie freshness — measured*).

## Non-goals

- **Not a replacement for Legacy.** `cookiesMode` (`off` / `file` / `browser`) stays exactly as it is.
- **Not a general-purpose browser.** v1 is YouTube and Google sign-in only. Other sites are a planned extension through the site-adapter seam (D5), each gated on its own sign-in and freshness check — not built in v1.
- **Not multi-account.** One session, one signed-in identity.
- **Arroxy never handles credentials.** No reading, injecting, autofilling, or observing the sign-in form. The user types into Google's page; we only own the window it renders in.

## Decisions (2026-10-13)

**D1 — Explore cookies are used only when a job needs them.** Downloads run
signed out by default, exactly as today. A job escalates to the Explore session
only when yt-dlp fails with a kind an account can fix, and only if
`cookiesMode` is `explore` (D6) and Explore is signed in:

| Escalates | Does not escalate |
|---|---|
| `loginRequired` (incl. private videos) | `ipBlock`, `rateLimit` — an account does not fix these; signing in under throttling adds ban risk |
| `ageRestricted` | `geoBlocked`, `unavailable`, `drmProtected`, everything else |
| `botBlock`, **after** `invokeWithRetry`'s PoT ladder is exhausted | |

Members-only content: verify which kind yt-dlp's message classifies as before
relying on it (may land in `unavailable`).

Escalation is **sticky for the whole job**: once a probe or video run
escalates, the job's `auth` becomes `exploreSession`, persists on the queue item
(so pause/resume and restart stay signed in), and every later spawn of that job
— probe retry, video, subtitles — uses the session. An escalation during the
video phase re-extracts rather than loading the signed-out probe's info-json.
If Explore is not signed in, the error is shown as today plus a "Sign in in
Explore" action. Rationale: the account is spent only where it unlocks
something (yt-dlp maintainers' and other apps' advice); the well-trodden
signed-out PoT path stays primary; signed-in sessions sometimes get *fewer*
formats (why `CookielessRetry` exists).

**D2 — Sign-in happens inline in the Explore pane.** The user clicks YouTube's
own Sign in; Google's page renders in the same view — the exact flow the spike
verified on three platforms. No separate window. Reversible: a dedicated window
would wrap the same engine and session if the inline flow proves cramped (e.g.
reCAPTCHA at 720x680).

**D3 — Explore is on by default, with a "New" badge; the URL tab stays the
launch tab.** Arroxy already has a tab bar (`URL | Downloads | Profiles |
Settings`, in `DownloadProfilesHome.tsx`); Explore joins it right after URL —
`URL | Explore (New) | Downloads | Profiles | Settings` — both being ways to start
a download. Conditions:

1. **Lazy load.** Nothing in the Explore partition loads until the user first opens the tab — no YouTube page, RAM/CPU, autoplay, or Google tracking cookies for users who never use it. Closing the app discards the view; the session persists.
2. **Kill switch.** A setting hides Explore entirely; the UA token stays runtime-configurable. If Google blocklists the token, Explore can be hidden or fixed without a release.
3. **Ban-risk notice** on Explore's first-run screen, before any sign-in: a downloader session carries account risk; use a secondary account (yt-dlp's own guidance).
4. **Legacy behaviour stays frozen.** Its tab bar gains one tab, and its cookie settings gain the `explore` option (D6); the `file` / `browser` / `off` paths and the Legacy flows behave exactly as today.

**D4 — Escalated jobs never drop cookies.** `CookielessRetry` does not apply to
a job whose `auth` is `exploreSession`: it escalated because the signed-out run
failed, so a cookieless retry would fail again. A quality-limited result on such
a job is kept and reported, as today. Legacy's `CookielessRetry` is unchanged.

**D5 — v1 is YouTube-only, structured for more sites.** Everything
site-specific lives in the site adapter as an optional `explore` capability on
`Site` (`src/shared/sites/`):

```ts
interface SiteExplore {
  homeUrl: string                 // where the tab opens
  allowedHosts: string[]          // navigation allowlist contribution (incl. the site's sign-in provider)
  cookieDomains: string[]         // a job receives only these domains' cookies
  isSignedIn(cookies: Cookie[]): boolean // YouTube: LOGIN_INFO + a SAPISID-family cookie
}
```

The navigation allowlist is the union of `allowedHosts` across Explore-capable
sites; a job's jar is filtered to its site's `cookieDomains` (a YouTube download
never carries another site's session). Site-neutral and shared: the single
partition, the UA token, per-spawn jars, discarding write-back, D1's escalation
kinds. Adding a site = an `explore` entry **plus** re-running the sign-in and
freshness checks for that site — both are YouTube findings. Not in v1: site
switching, per-site sign-in status, multi-site settings.

**D6 — Explore is a cookie mode.** `cookiesMode` becomes
`off | file | browser | explore`; the selected mode is the one identity source,
so a job never mixes two identities and there is no hidden precedence.

| Mode | Behaviour |
|---|---|
| `explore` | D1: anonymous by default; escalation uses the Explore session when signed in |
| `file`, `browser` | unchanged Legacy behaviour: those cookies on every run, `CookielessRetry` as today; no escalation |
| `off` | no cookies, ever — a real opt-out even when signed in to Explore |

The mode applies to every download regardless of which tab started it —
escalation lives in the download pipeline, so Legacy-tab downloads benefit too.

- **One-time migration:** on first start with this feature, `off` → `explore`; new installs default to `explore`. Safe to do silently because `explore` is inert until the user signs in. A marker (`cookiesModeExploreMigrated`) makes it run once, so a user who later picks `off` is never flipped back. `file` / `browser` are **not** migrated: those users are signed in today, a silent switch would break their gated downloads until they sign in to Explore, change on-every-run to on-demand behaviour, and may move them off a deliberately chosen secondary account.
- **In-tab nudge:** opening Explore while `cookiesMode !== 'explore'` shows an alert naming the current mode — "Downloads use your cookies file, not your Explore sign-in" — with **[Use Explore sign-in]** (sets `cookiesMode` to `explore` immediately; reversible in Settings) and **[Not now]** (remembered until `cookiesMode` next changes). It occupies its own row above the browser view — a `WebContentsView` cannot be overlaid by DOM, so it can never cover Google's form — and never stacks with the first-run ban-risk notice (that comes first). Reuse the existing `CookiesErrorAlert` / `OpenCookiesSettingsButton` patterns.

## The rule that must not be broken

**Never claim to be a browser we are not.**

Google's sign-in gate does not check the engine — it checks for deception. A UA
string asserting Chrome/Brave/Firefox/Safari while Client Hints
(`Sec-CH-UA`, `navigator.userAgentData`) say otherwise is a detectable lie and
gets `/v3/signin/rejected`. A bland token that asserts nothing checkable passes
the full `GlifWebSignIn` flow.

Consequences for implementation:

- The Explore session UA is Electron's default UA with the `Electron/<v>` and app-name tokens replaced by the **bland token `Desktop/1.0`**. Platform and Chromium version stay real so they agree with the client hints. Never a real browser's UA.
- **Not `Arroxy/<version>`.** It passes too, but it tells Google which downloader is signing in — a blocklist target and an account-flagging signal. Decided 2026-10-13.
- **Never override Client Hints** to match a spoofed UA. That is the failure mode, not the fix.
- The token is **runtime-configurable** (settings-backed, no release needed) because a blocklist is the plausible way this breaks.
- Honest `Electron/<v>` also passes but is *demoted* to `WebLiteSignIn`. Prefer the bland token; treat `Electron/` in the UA as a bug.
- A unit test must fail the build if a real-browser UA string appears in the Explore session path.

## Glossary additions

Add to [`CONTEXT.md`](../CONTEXT.md):

- **Explore** — the in-app browser tab and its signed-in session.
- **Explore session** — the persistent Electron session partition backing Explore.
- **Session cookies** — cookies read live from the Explore session, as opposed to a user-supplied file or an external browser.
- **Legacy** — today's URL-input wizard flow (the **URL** tab in the UI), kept unchanged alongside Explore. Internal term only.
- **Escalation** — switching one job from signed-out to the Explore session after a failure an account can fix.
- **Job auth** — a job's identity for yt-dlp: anonymous, or the Explore session after escalation; sticky for the job's lifetime.

## Architecture

### Main process

New `ExploreSessionService` (`src/main/services/ExploreSessionService.ts`) owns
the whole surface. Nothing else may touch the partition.

```ts
class ExploreSessionService {
  getSession(): Session                       // persist:arroxy-explore
  getUserAgent(): string                      // bland token, settings-backed
  readCookies(site: Site): Promise<Cookie[]>  // live read, never cached, filtered to site.explore.cookieDomains
  isSignedIn(site: Site): Promise<boolean>    // delegates to site.explore.isSignedIn (YouTube: LOGIN_INFO + SAPISID-family)
  signOut(): Promise<void>                    // clearStorageData on the partition
}
```

- Use **`WebContentsView`**, not `<webview>` (deprecated) and not a second `BrowserWindow`.
- Partition: `session.fromPartition('persist:arroxy-explore')`.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no preload with app privileges.
- Devtools disabled in packaged builds.

### Cookie handoff

Extend the existing `ResolvedCookies` union in
[`src/main/services/cookiesResolver.ts`](../src/main/services/cookiesResolver.ts):

```ts
type ResolvedCookies =
  | {kind: 'file'; path: string}
  | {kind: 'browser'; browser: CookiesBrowser}
  | {kind: 'session'}          // new — Explore
```

**Never store a jar.** For `kind: 'session'`, immediately before each yt-dlp
spawn: read cookies live from the session, write a Netscape-format temp jar with
`0600` permissions, spawn, delete the jar in a `finally`.

Integration point is [`YtDlp.ts:125`](../src/main/services/YtDlp.ts), where
`cookiesArgs` is built. The `session` kind resolves to `['--cookies', <tmpPath>]`,
same as `file`. The jar is scoped to **one spawn** — `invokeOnce`, not
`invokeWithRetry`, which can spawn up to three times (PoT, re-minted PoT,
fallback) and must give each spawn a fresh read.

**Why exported cookies die, and why this design avoids it** (yt-dlp maintainers,
[#8227](https://github.com/yt-dlp/yt-dlp/issues/8227),
[#12482](https://github.com/yt-dlp/yt-dlp/issues/12482),
[#14872](https://github.com/yt-dlp/yt-dlp/issues/14872), PR
[#13014](https://github.com/yt-dlp/yt-dlp/pull/13014)): there is no time-based
expiry. Page JS in any open YouTube tab calls `RotateCookies` (~10 min cadence),
replacing `__Secure-1PSIDTS`/`3PSIDTS`; the server then rejects older copies by
clearing `LOGIN_INFO`. A copy whose source session is never used again lasts
days–weeks. Every app that captures cookies once (Seal, YTDLnis, Tyrrrz
YoutubeDownloader, Grayjay) has "login expired" reports. Because the Explore
session *is* the rotating browser, a read immediately before each spawn always
carries the newest values.

**Discard yt-dlp's write-back; never merge it into the session.** `--cookies FILE`
is read *and* rewritten on exit (`YoutubeDL.close()` → `cookiejar.save()`, not
atomic, no opt-out). The rewrite adds yt-dlp's own `PREF` (`hl=en`, `tz=UTC`),
`SOCS`, drops `HttpOnly`, and — on a stale run — carries the cleared
`LOGIN_INFO`, which merged back would sign Explore out. Measured: yt-dlp changes
only `PREF` and the `SIDCC` family; it never receives rotated sign-in cookies.

**Cookie freshness — measured 2026-10-13** (macOS, signed-in Explore-style
partition, hidden `youtube.com` page kept loaded and reloaded every 15 min to
stand in for a user browsing; 12 checks over 3 h; Watch Later as oracle):

| Finding | Evidence |
|---|---|
| The session rotates `__Secure-1PSIDTS`/`3PSIDTS` **every 10.0 min** while a YouTube page is loaded, and immediately on the first load after idling | 18 rotation pairs at 8.9, 19.0, 29.0 … 179.6 min |
| A copy **one rotation behind still authenticates** | 6/6 passes |
| A copy **two or more rotations behind is rejected** — yt-dlp warns *no longer valid* and runs signed out | 6/7 fails (one 2-behind copy passed at tick 4) |
| ⇒ a snapshot is safe for **≥ 10 min** after capture (until the 2nd rotation), at most ~20 min | |
| Presenting rejected copies did **not** harm the live session — no theft-detection revocation | 6 stale presentations; every following fresh check passed, `LOGGED_IN` stayed true |
| A fresh read before a spawn **always** authenticated | 12/12 |
| yt-dlp's write-back on success changes only `PREF`, `SIDCC` family, `__Secure-YNID`; on a rejected run it **deletes every auth cookie** (`LOGIN_INFO`, `SID`, `SAPISID`, `__Secure-1PSID`, …) | write-back diff per run, names only |

Consequences: per-spawn fresh reads are sufficient because the queue runs one
yt-dlp process per item (playlist items are separate queue items) and auth is
exercised in a spawn's first seconds. The only exposed path is a single spawn
whose authenticated requests span >10 min while a YouTube page is open in the
partition (e.g. enumerating a huge channel) — the stale-cookie detection below
covers it. The write-back result makes "never merge" a hard rule.

**Stale-cookie detection.** yt-dlp only *warns* ("The provided YouTube account
cookies are no longer valid…") and continues signed out; `ytdlp-errors` has no
kind for it. Treat the warning as a hard signal: re-read the session, retry the
spawn once; if the session itself fails `isSignedIn()`, surface "Signed out of
Explore — sign in again" instead of silently degrading.

New pure module `src/main/services/netscapeCookieJar.ts` — `Cookie[]` → Netscape
text. Pure and unit-testable; no I/O.

### Navigation policy

- Allowlist: `youtube.com`, `google.com`, `accounts.google.com`, `gstatic.com`, `ggpht.com`, `googlevideo.com` and their subdomains. Everything else opens in the system browser via `shell.openExternal`.
- `setWindowOpenHandler` → `{action: 'deny'}`, routing popups to in-tab navigation or the system browser. Verified 2026-10-13: the full sign-in (incl. reCAPTCHA and TOTP) opened **no popups** on any platform, so a hard deny does not break it.
- Never inject scripts into `accounts.google.com`. Not for convenience, not for diagnostics.

### PO tokens

`HiddenWindowTokenProvider` keeps working and is unchanged by this feature, with
two follow-ups:

1. **Fix the existing UA bug** — it declares `X11; Linux x86_64 … Chrome/130` while running whatever host and Chromium it is actually on. This is the same class of lie described above and should be fixed regardless of Explore.
2. When Explore is signed in, mint tokens in the **authenticated** session so the token binds to the account's `DATASYNC_ID` rather than `VISITOR_DATA`.

**Corrected 2026-10-13:** the earlier "with cookies yt-dlp settles on
`android_vr` and needs no PO token" is out of date. As of yt-dlp
[#17805](https://github.com/yt-dlp/yt-dlp/pull/17805) (2026-10-10) signed-in
runs use `web_embedded` / `tv_samsung` / `web`, and `android_vr` does not
support cookies at all. PO tokens are therefore on the **primary** signed-in
path, and must bind to the account's `DATASYNC_ID` (pass `data_sync_id`), which
makes follow-up 2 a requirement, not an optimisation. Do not hard-code client
assumptions; they move with yt-dlp releases.

## Settings and schema

Per house rule, enums go in [`src/shared/schemas.ts`](../src/shared/schemas.ts) as `z.enum` → `z.infer` → `.options`.

```ts
export const jobAuthSchema = z.enum(['anonymous', 'exploreSession'])
```

New `common` fields:

| Field | Type | Default | Notes |
|---|---|---|---|
| `exploreEnabled` | `boolean` | `true` | Shows the Explore tab (D3 kill switch) |
| `exploreUserAgent` | `string?` | unset → `Desktop/1.0` | Advanced/hidden escape hatch if the token is blocklisted |
| `exploreNoticeSeen` | `boolean` | `false` | First-run ban-risk notice acknowledged |

Queue item / job: `auth: JobAuth`, default `'anonymous'`, set to
`'exploreSession'` by escalation and persisted (D1).

`cookiesModeSchema` gains `'explore'` (D6); `cookiesModeExploreMigrated:
boolean` and `exploreModeNudgeDismissedFor: CookiesMode?` join `common`.

Resolution: `resolveCookies(settings)` keeps its `file` / `browser` / `off`
branches exactly as today. Under `explore` it returns `null` for anonymous runs
and `{kind: 'session', site}` for a job whose `auth` is `exploreSession` and
whose site passes `isSignedIn`. No separate `cookieSource` setting — the mode is
the choice.

## UI

Mockups: [`design/in-app-browser/`](../design/in-app-browser/) — `Main.dc.html`
is the chosen split layout, `MinWindow.dc.html` the 720x680 floor.

- **Tab bar:** the existing one gains Explore after URL (D3), with a "New" badge; URL stays the launch tab. With `exploreEnabled` off, the Explore tab is absent and the bar is exactly today's. "Legacy" is internal vocabulary only — the user-facing label stays **URL**.
- **Five tabs at the 720px floor** with the longest locales (`el`, `fr`, `my`) is the main layout risk — extend the existing tab/overflow tests rather than adding a parallel check.
- **Explore first run:** ban-risk notice, then the YouTube home page. The view mounts on first open only (D3.1).
- **Sign-in inline** (D2) — no Arroxy UI over or around Google's form beyond the existing pane chrome; nothing injected.
- **Split pane**: browser above, download controls below. Must hold at the 720x680 minimum window.
- **Grab**: takes the current Explore URL into the download flow. No second URL input — the browser's address is the source of truth.
- **No sign-in status chip.** The browser shows the user's state; a redundant label was explicitly rejected.
- Use installed shadcn primitives. No Radix. Segmented controls follow the `toggleVariants` rules in AGENTS.md.
- Localised labels run 1.5–2x English — check `el`, `fr`, `my` against the tab bar at minimum width.

## IPC

Add to `IPC_CHANNELS` in [`src/shared/ipc.ts`](../src/shared/ipc.ts):

```
exploreNavigate      'explore:navigate'       // renderer → main
exploreGrabUrl       'explore:grabUrl'        // renderer → main
exploreSignOut       'explore:signOut'        // renderer → main
exploreGetState      'explore:getState'       // renderer → main
exploreStateChanged  'explore:stateChanged'   // main → renderer
```

`exploreGetState` / `exploreStateChanged` carry `{url, title, canGoBack,
canGoForward, signedIn}`. **Cookies never cross IPC.** The renderer has no
reason to see them and every reason not to.

## Security

- Temp jars: `0600`, deleted in a `finally`, never inside the user's output directory, filtered to the job's site `cookieDomains` (D5).
- Never log cookie values. Names and domains only, as used during this research.
- If cookies are ever persisted outside the session (they should not be), encrypt at rest via `safeStorage`.
- **The session's own cookie store is plaintext today.** `electron-builder.json5` sets only the `runAsNode` fuse; `EnableCookieEncryption` is off. Turn it on (OS keychain-backed, like Chrome) before Explore ships. It is app-wide, so verify existing partitions (`persist:youtube-hidden`) migrate cleanly.
- **Account safety by default:** cap concurrent signed-in spawns and pace them (yt-dlp wiki: ~2,000 videos/hour signed-in; 5–10 s between items recommended).
- The UI must warn that a downloader session carries account-ban risk, and recommend against using a primary account — this matches yt-dlp's own guidance.
- `NSBluetoothAlwaysUsageDescription` in the packaged macOS app, or Bluetooth security keys cannot complete 2FA.

## Testing

Following the layer ownership in AGENTS.md — Explore is **not** an excuse to
drive real YouTube login from CI.

| Layer | Covers |
|---|---|
| Unit (`tests/unit`) | Netscape jar writer; cookie-domain filter; escalation table (each kind escalates or not; botBlock only after the ladder); sticky `auth`; escalated jobs bypass `CookielessRetry`; cookie-mode migration (`off`→`explore` exactly once; `file`/`browser` untouched; later `off` respected); escalation only under `explore`; `resolveCookies` Legacy branches unchanged; allowlist from site adapters; stale-cookie warning → re-read + one retry; **UA invariant test** — fails if a real-browser UA or `Electron/` appears in the Explore path |
| Renderer (`tests/renderer`) | Mode nudge: shown when mode ≠ explore, [Use Explore sign-in] sets the mode, [Not now] remembered until the mode changes, never stacked with the first-run notice; Explore tab after URL; "New" badge; URL is still the launch tab; Explore absent when `exploreEnabled` off; first-run notice; view not mounted before first open |
| Browser mock (`tests/browser`) | Explore layout at 720x680 and 150% zoom; tab bar overflow across `el`/`fr`/`my` |
| Mock Electron E2E | Partition isolation from the app session; no cookies over IPC; devtools off when packaged; no Explore partition activity before first open |
| Fixture Product E2E | Grab → queue → download via the fixture extractor. **Escalation scenario:** the fixture server demands a cookie for one video (answers as age-restricted without it) — the signed-out probe fails, the job escalates with a seeded session cookie, downloads; oracles: the server log shows the cookie only on the escalated job's requests, the item's `auth` persisted, other items stayed anonymous, deny proxy clean. **Never real YouTube auth.** |
| Manual | Cross-platform sign-in matrix (below) |

**Manual matrix — executed 2026-10-13** with a throwaway spike (plain Electron
43.7.7, own persistent partition, UA token `Desktop/1.0`, no injection, no
synthetic input), a spare Google account with TOTP 2FA, signed in by hand.
Oracle: yt-dlp reads the account's Watch Later with the session jar and gets
*"The playlist does not exist"* without it.

| Platform | Page-load flow (`Desktop/1.0` / honest Electron control) | Real sign-in (pwd + TOTP) | `LOGGED_IN` | Cookies authenticate yt-dlp | Survives restart | Bot-wall relief |
|---|---|---|---|---|---|---|
| macOS 26 arm64 | `GlifWebSignIn` / `WebLiteSignIn` | pass | true | pass | pass | unproven |
| Windows 11 arm64 | `GlifWebSignIn` / `WebLiteSignIn` | pass | true | pass | pass | unproven |
| Ubuntu 26.04 arm64 (Wayland) | `GlifWebSignIn` / `WebLiteSignIn` | pass | true | pass | pass | unproven |

Observed on every platform, and binding on the implementation:

- **YouTube reloads itself on first load** (`?themeRefresh=1`), aborting the initial `loadURL` with `ERR_ABORTED`. Treat that abort as normal navigation, never as a failure. (`HiddenWindowTokenProvider` already loads the `themeRefresh` URL, likely for this reason.)
- **Google inserted `challenge/recaptcha` before the password step** every time (new account; may not apply to established ones). The Explore view must be large enough to solve a reCAPTCHA at the 720x680 floor.
- **Linux ran with `--no-sandbox`** — identical to the shipped Linux build (`build/afterPack.mjs`), so no deviation from production.
- Not yet run: x64 Windows/Linux (same Chromium; low risk — run one probe before release) and bot-wall relief (cannot be provoked on demand). Cookie freshness: see *Cookie freshness — measured*.

## Implementation order

1. `Site.explore` + `netscapeCookieJar.ts` (with domain filter) + `ExploreSessionService` (headless) → **verify:** unit tests; signed-in rule matches yt-dlp's.
2. Session cookie kind + per-spawn jar in `invokeOnce` + stale-cookie warning handling → **verify:** unit tests; Legacy's existing tests pass untouched.
3. Escalation (D1, D4): `exploreEscalation.ts`, `auth` on queue items, ProbeService/VideoPhase wiring, `CookielessRetry` bypass → **verify:** unit tests + the fixture E2E escalation scenario.
4. Schema/settings: `explore` cookie mode + one-time migration (D6), `EnableCookieEncryption` fuse → **verify:** `bun run check`; migration unit tests; existing partitions survive the fuse.
5. IPC + lazily mounted `WebContentsView` + navigation policy → **verify:** mock E2E (isolation, no cookies over IPC, nothing before first open).
6. Tab bar, "New" badge, first-run notice, mode nudge, Grab, `explore` option in cookie settings → **verify:** renderer + browser tests at 720x680 / 150% across worst-case locales; README screenshots regenerated.
7. PO tokens: fix `CHROME_UA`; bind signed-in tokens to `data_sync_id` → **verify:** an escalated job's spawn carries an account-bound token.
8. Manual matrix on the product build (macOS, Windows, Linux + one x64 probe) → **verify:** the table above repeated against the real app.

Steps 1–3 carry no UI risk and are useful on their own. The spike already
retired the step that could have invalidated the design.

## Open decisions

- **Session freshness when idle** — does a session with no YouTube page loaded stay valid overnight, and does Arroxy need a periodic refresh load before escalated jobs? Overnight parked check pending.
- **Members-only classification** — which `YtDlpErrorKind` yt-dlp's members-only message maps to (D1).
- Whether an ADR is warranted for "bland UA, never impersonate". It fits the criteria (hard to reverse, surprising without context, real trade-off), and `YOUTUBE-AUTH-RESEARCH.md` is long-form research rather than a decision record.
