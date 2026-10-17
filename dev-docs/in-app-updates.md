# In-app updates

How the update banner works: the check, the per-channel action, and the one known gap.

| Lives in | What |
| --- | --- |
| `src/main/ipc/registerUpdaterHandlers.ts` | Update check, `updater:available`, `updater:install` |
| `src/main/installChannel.ts` | Install channel detection |
| `src/renderer/src/components/system/updateBannerAction.ts` | `resolveAction(channel, platform)` |

## Check and channel actions

`electron-updater` v6, GitHub provider. Auto-download is **disabled**: the user starts everything. Main calls `autoUpdater.checkForUpdates()` 5 s after launch and emits `updater:available` to the renderer with `{version, currentVersion, installChannel}`. `installChannel` detection (flatpak/scoop/homebrew/portable/direct) lives in `src/main/installChannel.ts`. `direct` intentionally absorbs Winget: at runtime it is indistinguishable from a direct NSIS install, and NSIS auto-update works either way.

`<UpdateBanner>` sits between the title bar and the content; `resolveAction(channel, platform)` picks the UX:

- `scoop` → copy-command for `scoop update arroxy`
- `homebrew` → copy-command for `brew upgrade --cask arroxy`
- `flatpak` → copy-command for `flatpak update io.github.antonio_orionus.Arroxy` (updates come from Arroxy's own Flatpak repo, [flatpak-repo.md](flatpak-repo.md)). On Linux electron-updater only checks inside an AppImage, so Flatpak sets `autoUpdater.forceDevUpdateConfig` to let the *check* run; `flatpak` is non-installable and nothing is downloaded.
- `portable` → "Download ↗" link to https://orionus.dev/arroxy/ (NSIS auto-update can't run from a %TEMP% extract)
- `direct` on darwin → "Download ↗" link to https://orionus.dev/arroxy/ (the DMG is unsigned and can't self-update)
- `direct` on win/linux (and `winget`) → "Install & Restart" → `updater:install` → main calls `downloadUpdate()`, then `quitAndInstall(false, true)` on `update-downloaded`

## Known gap: Linux tar.gz never sees the banner

On Linux, electron-updater's default updater is `AppImageUpdater` (no `package-type` file shipped — we only build AppImage + tar.gz). `AppImageUpdater.isUpdaterActive()` returns `false` when `process.env.APPIMAGE` is unset, which silently short-circuits `AppUpdater.checkForUpdates()` (returns `null`, logs `"APPIMAGE env is not defined, current application is not an AppImage"`, never emits `update-available`). So tar.gz Linux users get **no update banner at all** — not an error, just silence. Verified in `node_modules/electron-updater/out/AppImageUpdater.js:17-28` and `AppUpdater.js:253-256`.

**Decision: do not fix.** Audience is small (most Linux users get AppImage or Flatpak). Fixing would require bypassing electron-updater for this case and hitting `https://api.github.com/repos/antonio-orionus/Arroxy/releases/latest` directly to drive our own `updater:available` IPC.

## IPC + types

IPC channel names live in `IPC_CHANNELS` (`@shared/ipc`); payload types (`InstallChannel`, `UpdateAvailablePayload`) live in `@shared/types`. `resolveAction` is the pure helper at `src/renderer/src/components/system/updateBannerAction.ts` — extracted from `UpdateBanner.tsx` so the component file only exports a component (react-refresh requirement). Renderer `browser-mock` mode at `src/renderer/src/browserMock.ts` simulates an `updater:available` event only for explicit update scenarios.
