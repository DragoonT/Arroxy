# Subtitle tracks are planned once per job, at run time, from complete lists

Revises the playlist-entry consequence of ADR 0014.

A job's subtitle tracks used to be decided wherever the job was built. The
Format screen and Quick Download turned languages into exact tracks from the
probe, and playlist rows kept language codes. The subtitle phase then turned
codes into tracks from an info-json if one was at hand, or else sent yt-dlp the
codes as a pattern, which also matched YouTube's machine translations. Sites
whose extractors fill subtitle lists only when asked (Vimeo, TikTok, Bilibili)
always got the pattern. Each fix reached the paths its reporter used.

A job now carries a subtitle request (languages and a subtitle source, or the
tracks picked on the Format screen), never resolved tracks. The subtitle phase
plans the tracks once, by the same rule the Format screen previews with, from
lists that are always complete: an info-json from a site that lists subtitles
eagerly, otherwise a listing run (`-J` with the subtitle flags, which fills the
lists for every extractor and writes no files). The fetch then loads that JSON
(`--load-info-json`), so it reuses the listed URLs instead of extracting again.
The argv, the embedded tracks' language and title, the files, and the outcome
when nothing matches are all read off the plan.

When the video has none of the requested languages, the plan says so before
anything is fetched. A subtitles-only job then ends as a hard failure that names
the missing languages, since it leaves nothing usable, and is not retried
automatically. A job with media ends as a soft failure with the same notice,
keeping the video.

Rejected:

- **Resolving at queue time.** Playlist rows are queued before their video is
  known, and probing every row first would make queueing as slow as the
  playlist is long.
- **Keeping the language pattern for sites without complete lists.** It is the
  one path that can fetch a translation instead of the track asked for, and it
  makes the outcome unknowable before yt-dlp runs.

## Consequences

On sites without eager subtitle lists a subtitle phase makes one metadata
request before fetching. That accepts one extra request per job; the number of
extractions stays the same, because the fetch no longer extracts. On YouTube,
with the media run's info-json at hand, it makes none.

Queue rows saved with the old subtitle options are migrated when the queue
loads, like the other per-row migrations: language codes become a language
request, exact track keys a track request.
