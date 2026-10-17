# Binary distribution

How the embedded ffmpeg/ffprobe get into the app and stay licensed and verified. yt-dlp's runtime manifest is in [`runtime-binaries.md`](runtime-binaries.md); the decision is ADR 0003.

## Strategy

Arroxy ships three third-party binaries, split by update cadence:

| Binary | Strategy | Source | Why |
| --- | --- | --- | --- |
| ffmpeg + ffprobe | **Embedded at build time** via `extraResources` | BtbN GPL builds (Win/Linux), Martin-Riedl GPL (macOS) | Static codec semantics; pair coherence solved by construction |
| yt-dlp | Runtime-fetched | GitHub `yt-dlp/yt-dlp(-nightly-builds)` | Ships fixes about weekly with YouTube's bot-protection cycle; can't bundle and ship an app release per fix |

**Electron as Node.** `electron-builder.json5` keeps the `runAsNode` fuse enabled because the packaged Electron executable is yt-dlp's Node runtime. `ELECTRON_RUN_AS_NODE=1` goes only into the yt-dlp child-process environment, never `process.env` or persisted config. Packaged runtime smoke tests assert the fuse, Node >=22, child-env isolation, managed yt-dlp selection and bundled EJS availability.

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
