# Binary distribution

How the embedded ffmpeg/ffprobe get into the app and stay licensed and verified. `AGENTS.md` keeps the strategy table and the Electron-as-Node security rule; yt-dlp's runtime manifest is in [`runtime-binaries.md`](runtime-binaries.md).

| Lives in | What |
| --- | --- |
| `scripts/build/fetch-embedded.sh` | Fetch, verify and extract ffmpeg/ffprobe per platform |
| `build/beforeBuild.mjs` | electron-builder hook that runs the fetch |
| `electron-builder.json5` | `extraResources` that copy binaries and notices |
| `scripts/test-binaries/` | Upstream-source smoke scripts (must stay tracked) |

## How embed works

- `scripts/build/fetch-embedded.sh <platform> <arch>` — fetches + verifies SHA + extracts ffmpeg+ffprobe (and Linux `libav*.so*` siblings) into `build/embedded/<platform>-<arch>/`. Reuses smoke-all.sh helpers via `scripts/test-binaries/_lib.sh`.
- `build/beforeBuild.mjs` — electron-builder lifecycle hook, fires once per `(platform, arch)` build. Calls fetch-embedded.sh.
- `electron-builder.json5` — per-platform `extraResources` with `${arch}` substitution copies the fetched binaries into `<resources>/` of the packed app.
- Runtime: `BinaryManager.getFfmpegPath()` returns `process.resourcesPath/ffmpeg(.exe)` in prod, `build/embedded/<host>/ffmpeg(.exe)` in dev. `app.isPackaged` branches.
- Linux only: BtbN's shared build expects `libav*.so.*` siblings; `spawnYtDlp` + `spawnFFmpeg` + `probeBinary` all inject `LD_LIBRARY_PATH=<dir>` at spawn time. No rpath patching needed.

## License attribution

`THIRD_PARTY_NOTICES.txt` ships at `<resources>/` via top-level `extraResources`. Covers ffmpeg (GPLv3) and yt-dlp (Unlicense). Arroxy stays MIT — spawn ≠ link, no GPL propagation into our code.

## Smoke parity

`scripts/test-binaries/smoke-all.sh` validates upstream binary source availability for runtime manifest automation and embedded ffmpeg/ffprobe fetches. Run before bumping fetch-embedded.sh asset names or runtime manifest source facts. **`scripts/test-binaries/` directory must stay tracked** — an earlier `.gitignore` rule `test-binaries/` accidentally matched it. Now anchored: `**/build/embedded/` (build output) and `/test-binaries/` (smoke output, root only).
