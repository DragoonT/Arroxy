// @vitest-environment node
//
// Pause All / Resume All across the real seam between QueueService and
// DownloadService (mock mode: no yt-dlp process, a timer stands in for the
// transfer). The queue store is faked; the job bookkeeping (activeJobs,
// pausedJobs) is the real one, so a test can see whether a parked job is
// resumed or left behind.

import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it, vi} from 'vite-plus/test'
import {QueueService} from '@main/services/QueueService.js'
import {DownloadService} from '@main/services/DownloadService.js'
import {YtDlp} from '@main/services/YtDlp.js'
import type {ActiveDownload, PausedDownload} from '@main/services/phases/index.js'
import type {QueueStore} from '@main/stores/QueueStore.js'
import {ok} from '@shared/result.js'
import {makeItem} from '../shared/fixtures.js'

function deferred(): {promise: Promise<void>; resolve: () => void} {
	let resolve: () => void = () => undefined
	const promise = new Promise<void>(res => {
		resolve = res
	})
	return {promise, resolve}
}

function fakeStore(): QueueStore {
	return {load: vi.fn().mockResolvedValue(ok({items: [], schedulerPaused: false})), save: vi.fn().mockResolvedValue(ok(undefined))} as unknown as QueueStore
}

// `binariesReady` holds every job in "Preparing" (binary setup) until it resolves.
function makeServices(binariesReady: Promise<void> = Promise.resolve()) {
	const binaryManager = {ensureYtDlp: vi.fn(() => binariesReady.then(() => '/tmp/yt-dlp')), ensureFFmpeg: vi.fn().mockResolvedValue('/tmp/ffmpeg'), ensureFFprobe: vi.fn().mockResolvedValue(null)}
	const tokenService = {getToken: vi.fn().mockResolvedValue({token: 'mock-token', visitorData: 'mock-visitor'})}
	const recentJobsStore = {push: vi.fn().mockResolvedValue(undefined)}
	const ytDlp = new YtDlp(binaryManager as never, tokenService as never, {get: vi.fn().mockResolvedValue({})})
	const downloads = new DownloadService(ytDlp, recentJobsStore as never, true)
	const queue = new QueueService(fakeStore(), downloads)
	const internals = downloads as unknown as {activeJobs: Map<string, ActiveDownload>; pausedJobs: Map<string, PausedDownload>}
	return {queue, downloads, binaryManager, internals}
}

let outputDir: string | undefined

afterEach(async () => {
	vi.useRealTimers()
	if (outputDir) await rm(outputDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 100})
	outputDir = undefined
})

async function itemIn(id: string) {
	outputDir = await mkdtemp(join(tmpdir(), 'arroxy-queue-pause-'))
	return makeItem({id, status: 'pending', outputDir})
}

describe('Pause All while a download is still starting', () => {
	it('pauses the starting download instead of letting it run once its start finishes', async () => {
		const binaries = deferred()
		const {queue, downloads, binaryManager} = makeServices(binaries.promise)
		queue.add([await itemIn('a')])
		await vi.waitFor(() => expect(binaryManager.ensureYtDlp).toHaveBeenCalledOnce())
		expect(queue.snapshot()[0]?.status).toBe('pending')

		const result = await queue.pauseAll()
		expect(result.done).toEqual(['a'])

		vi.useFakeTimers()
		binaries.resolve()
		await vi.waitFor(() => expect(downloads.pausedCount).toBe(1))
		const row = queue.snapshot()[0]
		expect(row?.status).toBe('paused-active')
		expect(downloads.runningJobCount).toBe(0)

		await queue.cancel(null)
	})

	it('parks a single download paused while it is still starting', async () => {
		const binaries = deferred()
		const {queue, downloads, binaryManager} = makeServices(binaries.promise)
		queue.add([await itemIn('a')])
		await vi.waitFor(() => expect(binaryManager.ensureYtDlp).toHaveBeenCalledOnce())

		expect((await queue.pause('a')).ok).toBe(true)
		expect(queue.snapshot()[0]?.status).toBe('paused-held')

		vi.useFakeTimers()
		binaries.resolve()
		await vi.waitFor(() => expect(downloads.pausedCount).toBe(1))
		expect(queue.snapshot()[0]?.status).toBe('paused-active')
		expect(downloads.runningJobCount).toBe(0)
		await queue.cancel(null)
	})
})
