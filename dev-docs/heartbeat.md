# Heartbeat — Internal Reference

Arroxy has no telemetry. The only thing it reports is one anonymous heartbeat per install per UTC day, sent to a self-hosted [Counterscale](https://github.com/benvinegar/counterscale) on Cloudflare. It answers how many people use the app, where they are, and on which version, OS, and language. Code lives in:

| Path                                        | Role                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `src/main/services/heartbeat.ts`            | Field mapping, once-per-UTC-day gate, Counterscale sender, collector URL |
| `src/main/index.ts`                         | Wiring: snapshot inputs, startup heartbeat, hourly re-check             |
| `src/main/stores/SettingsStore.ts`          | `recordHeartbeatDay()` — internal `lastHeartbeatDay`                    |
| `tests/unit/heartbeat.test.ts`             | Mapping, daily gate, and the real tracker's request URL                 |

## What is sent

One `GET <collector>/collect?...` built by `@counterscale/tracker/server`. No install ID, no IP-derived data from the app, no URLs, titles, or paths. Country is added by Cloudflare at the collector from the request; Counterscale stores the country code, never the IP.

The heartbeat is skipped when **Send daily heartbeat** is off (`analyticsEnabled`; the key predates this design and is kept so existing opt-outs stay opted out), always in E2E sessions (test runs must never reach a collector), in dev, mock and smoke sessions unless `ARROXY_HEARTBEAT_URL` names one (HTTPS, or plain HTTP only to localhost), and on any day already recorded in `lastHeartbeatDay`. The day is recorded before the request goes out: a lost heartbeat beats a day counted twice. A session left running in the tray re-checks hourly and sends once on each new UTC day.

The heartbeat cannot fail loudly. Network errors and timeouts (5 s) are swallowed by the tracker; any local failure (settings write, snapshot) is logged once at warn as `Heartbeat skipped for today` and not retried until the next UTC day. `lastHeartbeatDay` is read leniently, so a malformed value can never reset the user's settings section.

## Dashboard mapping

Counterscale is built for websites, so app fields ride in the slots its dashboard already breaks down. Its server tracker sends hit type 1 on every request, so **Visitors per day = daily active installs**.

| Dashboard card | Holds               | Example        |
| -------------- | ------------------- | -------------- |
| Visitors       | active installs     | —              |
| Country        | Cloudflare country  | `UA`           |
| Path           | app version         | `/0.5.1`       |
| UTM Source     | install channel     | `homebrew`     |
| UTM Medium     | platform-arch       | `win32-x64`    |
| UTM Campaign   | OS release          | `windows-11`, `macos-26`, `linux-6.8` |
| UTM Term       | app UI language     | `uk`           |
| UTM Content    | OS locale           | `uk-UA`        |

Values never contain spaces: a collector that decodes `+` and `%20` differently must still store the same value (the local Vite-based Counterscale dev server turned `%20` into `+`).

Browser, Device and Referrer cards stay empty or constant — ignore them.

## Deploy

The live collector is Counterscale 3.4.1 built **from source with an auth patch** (see below), deployed with Wrangler as Worker `counterscale` on the custom domain `stats.orionus.dev` (`HEARTBEAT_URL` in `heartbeat.ts`; released builds keep the host they shipped with). Site id: `arroxy` (`HEARTBEAT_SITE_ID`). `workers.dev` is off.

1. **Analytics Engine.** Dashboard → Storage & Databases → Analytics Engine → Create Dataset `metricsDataset`. If a deploy still fails with `[code: 10089] You need to enable Analytics Engine` (a leftover beta opt-in gate, cloudflare/workers-sdk#9312), deploy once without the `analytics_engine_datasets` block, add the binding `WEB_COUNTER_AE` → `metricsDataset` on the Worker in the dashboard (Settings → Bindings), then deploy normally.
2. **R2 bucket** for the daily rollup: `bunx wrangler r2 bucket create counterscale-daily-rollups`.
3. **Build and deploy from source** (outside this checkout — npm-family tools hit this repo's `overrides`):

   ```bash
   git clone --depth 1 --branch v3.4.1 https://github.com/benvinegar/counterscale.git
   cd counterscale && pnpm install --frozen-lockfile && cd packages/server
   # apply the auth patch below, then:
   pnpm exec react-router build
   pnpm exec wrangler deploy --config wrangler.arroxy.json --var VERSION:v3.4.1-authpatch
   ```

   `wrangler.arroxy.json` is `wrangler.json` plus `"account_id"` and `"routes": [{"pattern": "stats.orionus.dev", "custom_domain": true}]`.
4. **Secrets** on the Worker: `CF_ACCOUNT_ID`, `CF_AUTH_ENABLED=true`, `CF_JWT_SECRET` (random), `CF_PASSWORD_HASH` (bcrypt of the dashboard password), `CF_BEARER_TOKEN` (API token with only **Account › Account Analytics › Read**). Set them with `wrangler secret bulk <json-file> --config wrangler.arroxy.json`, never by pasting values into chat or commits. With `CF_AUTH_ENABLED=true` and no password hash the dashboard fails closed (500), which is the safe interim state. The Counterscale CLI's `auth` commands run Wrangler through npm's package runner; run them from `~`, not from a repo checkout.

5. **Rate limit** on the zone (`orionus.dev` → Security → WAF → Rate limiting rules; the Free plan's one rule): `http.host eq "stats.orionus.dev" and http.request.uri.path eq "/collect"`, counted per IP and colo, 5 requests per 10 seconds, block for 10 seconds. A real install sends one heartbeat a day, so this only stops floods from one address; it cannot stop fake heartbeats spread across many IPs, and nothing can without an identifier. Verify with a burst of parameterless `curl` requests to `/collect`: the first few return `400`, the rest `429`.

### Auth patch (required until upstream fixes it)

Counterscale ≤ 3.4.1 checks the login only on the `stats`, `timeseries` and `paths` data routes; `country`, `device`, `referrer`, `browser`, `browserversion` and the five `utm-*` routes answer anyone — and the UTM routes hold the heartbeat's install channel, platform, OS and languages. Before every build, add the same guard to each unprotected `app/routes/resources.*.tsx` loader:

```ts
import { requireAuth } from "~/lib/auth";

export async function loader({ context, request }: LoaderFunctionArgs) {
    await requireAuth(request, context.cloudflare.env);
    // ...
```

and add `vi.mock("~/lib/auth", () => ({ requireAuth: vi.fn() }));` to the matching `__tests__/resources.*.test.tsx`, as the `stats` test already does (`TZ=EST pnpm exec vitest run` must pass). After deploying, every `https://stats.orionus.dev/resources/<route>?site=arroxy` must return `302` without a session cookie.

Free-plan fit: Analytics Engine takes 100k writes/day and keeps raw data 90 days; Counterscale's daily R2 rollup (on by default) keeps older data within R2's free tier.

## Test locally end to end

```bash
git clone --depth 1 --branch v3.4.1 https://github.com/benvinegar/counterscale.git
cd counterscale && pnpm install --frozen-lockfile
cd packages/server && pnpm exec react-router dev --port 3005 --host 127.0.0.1
```

Locally the Analytics Engine write is simulated, so add a temporary `console.log(JSON.stringify(datapoint))` at the top of `writeDataPoint` in `app/analytics/collect.ts` (in the Counterscale clone) to see what would be stored. Then from the Arroxy checkout:

```bash
ARROXY_HEARTBEAT_URL=http://127.0.0.1:3005/collect bun run dev
```

Expect one data point with index `arroxy` and blobs `/<version>`, channel, platform-arch, OS release, UI language, OS locale. A relaunch on the same UTC day sends nothing; delete `common.lastHeartbeatDay` from `.electron-user-data/dev/settings.json` to send again.
