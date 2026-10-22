// Reading a probe's yt-dlp output: playlist progress lines while it runs, and
// the info JSON it prints last.

import {stripVTControlCharacters} from 'node:util'
import type {ProbeProgressEvent} from '@shared/types.js'

const PLAYLIST_ITEM_PROGRESS_RE = /\[download\]\s+Downloading item\s+(\d+)\s+of\s+(\d+|N\/A)/i
const YOUTUBE_TAB_PAGE_PROGRESS_RE = /\[youtube:tab\]\s+.+?\spage\s+(\d+):\s+Downloading API JSON/i

export function parseProbeProgressLine(line: string): Pick<ProbeProgressEvent, 'phase' | 'loaded' | 'total'> | null {
	const clean = stripVTControlCharacters(line)
	const pageMatch = YOUTUBE_TAB_PAGE_PROGRESS_RE.exec(clean)
	if (pageMatch) {
		const loaded = Number(pageMatch[1])
		return Number.isFinite(loaded) ? {phase: 'pages', loaded} : null
	}
	const itemMatch = PLAYLIST_ITEM_PROGRESS_RE.exec(clean)
	if (!itemMatch) return null
	const loaded = Number(itemMatch[1])
	if (!Number.isFinite(loaded)) return null
	const rawTotal = itemMatch[2]
	const total = rawTotal && rawTotal !== 'N/A' ? Number(rawTotal) : undefined
	return {phase: 'items', loaded, ...(total !== undefined && Number.isFinite(total) ? {total} : {})}
}

export function parseProbeJsonOutput(stdout: string): unknown {
	let lastJsonError: unknown = null
	const lines = stdout.split(/\r?\n/).flatMap(line => {
		const trimmedLine = line.trim()
		return trimmedLine ? [trimmedLine] : []
	})
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i]
		if (!line?.startsWith('{')) continue
		try {
			return JSON.parse(line)
		} catch (error) {
			lastJsonError = error
		}
	}
	if (lastJsonError) throw lastJsonError
	return JSON.parse(stdout)
}
