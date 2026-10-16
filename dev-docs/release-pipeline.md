# Release pipeline internals

What happens after `bun run release:stable` / `release:beta` pushes a tag. `AGENTS.md` keeps the rules for cutting a release; [`release-runbook.md`](release-runbook.md) is the manual checklist and [`flatpak-repo.md`](flatpak-repo.md) covers the Flatpak repo.

| Lives in | What |
| --- | --- |
| `.github/workflows/release.yml` | Tag-triggered build, publish, package-manager bumps |
| `.github/workflows/release_to_winget.yml` | Winget PR on the `released` event |
| `scripts/release.sh` | Tag guards: branch, clean tree, version, required checks |

## Job graph

`.github/workflows/release.yml`: `verify-version` → `quality-gate` (`bun run check`) → `prepare-release` → `build` matrix (linux + mac on `ubuntu-latest`/`macos-latest`); `fetch-flatpak-source` downloads the Linux tarball from the draft release after `build` (it alone holds the write token; drafts are invisible to a read-only one), then `build-flatpak` (read-only: builds, signs the Flatpak repo with `scripts/flatpak/publish-repo.sh`, builds the bundle), then `upload-flatpak`; `publish-release` waits for `upload-flatpak`, polls for Windows assets, generates `SHA256SUMS`, then un-drafts the release. Stable tags also run `publish-scoop`, `publish-homebrew`, `publish-flatpak-repo` (GitHub Pages deploy), and `notify-web-release-manifest` after `publish-release`. Read the YAML for step-level detail.

Windows is built separately via a dedicated Windows Installer workflow (smoke-testable before publish); `publish-release` polls up to 15min until the Windows Setup + Portable `.exe` artifacts appear before generating `SHA256SUMS` and un-drafting the release.

Arroxy uses GitHub immutable releases for release asset integrity and the GitHub release asset verification UI. The workflow finishes all mutable release work while the release is still a draft, then publishes/undrafts as the last step. `actions/attest` is intentionally not used for release assets; immutable releases create release attestations for the published assets, while workflow provenance attestations are a separate SLSA/build-chain concern. Keep `SHA256SUMS` for package-manager hashes and offline verification; keep updater metadata (`latest*.yml`) and blockmaps outside the checksum contract.

`.github/workflows/release_to_winget.yml` triggers on the `released` event: once `publish-release` un-drafts the release, the SHA-pinned `vedantmgoyal9/winget-releaser` action runs `komac update AntonioOrionus.Arroxy --submit` → opens a PR against `microsoft/winget-pkgs`. Microsoft reviewers merge within hours-to-a-day. Keep that third-party action pinned to a full commit SHA because it receives `WINGET_TOKEN`.

## Required GitHub repo secret

| Secret                    | Used by            | Scope                                                        |
| ------------------------- | ------------------ | ------------------------------------------------------------ |
| `WINGET_TOKEN`            | all 3 publish jobs | classic PAT, `public_repo` + `workflow`                      |
| `FLATPAK_GPG_PRIVATE_KEY` | `build-flatpak`    | signs the Flatpak repo; must match `flatpak/repo-signing-key.asc` |

Despite the name, this single token authenticates Scoop, Homebrew, **and** Winget pushes (needs `public_repo` to push to external bucket/tap repos and to fork `microsoft/winget-pkgs`). Rotate every 90 days.

## Initial Winget submission (one-time, done)

The `vedantmgoyal9/winget-releaser` action can only **update** an existing winget package, not create one. For Arroxy this was done once via [komac](https://github.com/russellbanks/Komac) (`komac new AntonioOrionus.Arroxy …`) → submitted PR [microsoft/winget-pkgs#365414](https://github.com/microsoft/winget-pkgs/pull/365414). Future tag pushes auto-bump the existing manifest with no manual work.

If we ever change the PackageIdentifier, repeat that one-time submission for the new identifier and update `release_to_winget.yml`.

## External repos this pipeline writes to

- [`antonio-orionus/scoop-bucket`](https://github.com/antonio-orionus/scoop-bucket) — single `bucket/arroxy.json` manifest, auto-bumped per release
- [`antonio-orionus/homebrew-arroxy`](https://github.com/antonio-orionus/homebrew-arroxy) — single `Casks/arroxy.rb` cask with `on_arm`/`on_intel` stanzas, auto-bumped per release
- [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs) — community repo; PRs land at `manifests/a/AntonioOrionus/Arroxy/<version>/`
- This repo's GitHub Pages — Arroxy's Flatpak repo at https://antonio-orionus.github.io/Arroxy/flatpak/, replaced by every stable release (`publish-flatpak-repo`). See [`dev-docs/flatpak-repo.md`](dev-docs/flatpak-repo.md); never rotate its signing key casually — installed copies reject updates signed by another key.

GitHub Releases ships: NSIS installer, portable `.exe`, arm64 DMG, x64 DMG, AppImage, tar.gz source, and a Flatpak bundle (stable bundles carry the Flatpak repo as their remote, so `flatpak update` works after installing one). No Snap. An AUR `arroxy-bin` package (repackaging the x64 tar.gz, auto-published like Scoop/Homebrew) is on the roadmap for Arch/Omarchy users, blocked until AUR reopens new-account registration (closed as of 2026-10).

## Pre-release flow (test pipeline w/o auto-updating users)

Tag w/ semver pre-release suffix (e.g. `v0.4.0-beta.1`):

- electron-builder marks the GitHub Release `prerelease: true` automatically (semver `-` suffix triggers it).
- electron-updater queries `/releases/latest` (excludes pre-releases) → existing user installs do **not** auto-update.
- `release.yml` `publish-scoop`/`publish-homebrew` jobs guard `if: !contains(github.ref_name, '-')` so beta tags don't bump public package managers.
- Winget skipped automatically — `release_to_winget.yml` triggers on `released` event which excludes pre-releases by GitHub API design.
- Manually download the artifact from the GitHub Release page to validate.
- When ready: bump to plain semver (`v0.4.0`), tag annotated, push.

**NSIS installer:** pin `electron-builder ≥ 26.9.0` (26.8.x has a `multiUser.nsh:35` buffer over-read on cold-heap). Drop `build/installer.nsh`. Any future custom NSIS `Page custom` callback must open with `${If} ${Silent} \n Abort \n ${EndIf}`. Note: the registry `latest` dist-tag is broken `26.8.1`; pin from `next` channel — `bun update --latest` silently downgrades.
