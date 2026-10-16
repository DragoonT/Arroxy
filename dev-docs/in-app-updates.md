# In-app updates

Details behind the update banner. `AGENTS.md` keeps the channel-to-action rules.

| Lives in | What |
| --- | --- |
| `src/main/ipc/registerUpdaterHandlers.ts` | Update check, `updater:available`, `updater:install` |
| `src/main/installChannel.ts` | Install channel detection |
| `src/renderer/src/components/system/updateBannerAction.ts` | `resolveAction(channel, platform)` |

## Known gap: Linux tar.gz never sees the banner

On Linux, electron-updater's default updater is `AppImageUpdater` (no `package-type` file shipped — we only build AppImage + tar.gz). `AppImageUpdater.isUpdaterActive()` returns `false` when `process.env.APPIMAGE` is unset, which silently short-circuits `AppUpdater.checkForUpdates()` (returns `null`, logs `"APPIMAGE env is not defined, current application is not an AppImage"`, never emits `update-available`). So tar.gz Linux users get **no update banner at all** — not an error, just silence. Verified in `node_modules/electron-updater/out/AppImageUpdater.js:17-28` and `AppUpdater.js:253-256`.

**Decision: do not fix.** Audience is small (most Linux users get AppImage or Flatpak). Fixing would require bypassing electron-updater for this case and hitting `https://api.github.com/repos/antonio-orionus/Arroxy/releases/latest` directly to drive our own `updater:available` IPC.

## IPC + types

IPC channel names live in `IPC_CHANNELS` (`@shared/ipc`); payload types (`InstallChannel`, `UpdateAvailablePayload`) live in `@shared/types`. `resolveAction` is the pure helper at `src/renderer/src/components/system/updateBannerAction.ts` — extracted from `UpdateBanner.tsx` so the component file only exports a component (react-refresh requirement). Renderer `browser-mock` mode at `src/renderer/src/browserMock.ts` simulates an `updater:available` event only for explicit update scenarios.
