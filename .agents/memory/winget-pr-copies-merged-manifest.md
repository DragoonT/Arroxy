---
name: winget-pr-copies-merged-manifest
description: The release's Winget PR copies licence, descriptions and tags from the last merged manifest; fix them by hand until a corrected one merges, and quote any value containing ": ".
metadata:
  type: project
---

The `release_to_winget.yml` PR to `microsoft/winget-pkgs` takes `License`,
`ShortDescription`, `Description` and `Tags` from the last **merged** Arroxy
manifest, not from this repo. Until a manifest carrying GPL-3.0-or-later and the
new description merges (0.6.2 was the last merged one, still MIT and "YouTube
downloader based on yt-dlp"), every release PR needs the same hand edit:
`License: GPL-3.0-or-later`, the current descriptions, and no `yt-dlp` /
`yt-dlp-gui` tags. Copy them from the newest Arroxy Winget PR.

Quote any value that contains ": " (colon, space). Unquoted, it breaks the YAML,
and Winget only reports "02. Manifest Validation: fail" with no reason. That
happened on the 0.7.1 PR (2026-10-20): its Description had "what you are
watching: videos". Validate locally against
`https://raw.githubusercontent.com/microsoft/winget-cli/master/schemas/JSON/manifests/v1.12.0/manifest.defaultLocale.1.12.0.json`
before pushing, and keep the files' CRLF line endings.

**How to apply:** after each stable release, open the Winget PR the release
created, fix those fields on the fork branch (`antonio-orionus/winget-pkgs`),
then check that its validation passes. Delete this note once a manifest with the
new text has merged. Related: [[ship-means-merge-not-release]].
