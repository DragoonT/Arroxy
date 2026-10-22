import {expect, test, type Page} from '@playwright/test'
import {FIXTURE_VIDEO_IDS, type FixtureServer, type FixtureServerRequest} from './fixtureHarness.js'
import {withFixtureProductApp} from './fixtureProductE2E.js'

// Persistence and restart risk group: links still being checked when the app
// quits are checked again on the next launch, paced as before, instead of
// coming back as error rows that each need a Retry.
//
// Fixtures: four videos whose probes the server holds open (metadataHeldIds)
// until the test releases them; two links are checked at once.
// Actions: Quick Download four links from the URL tab, quit while they probe,
// launch again on the same profile, then release the probes.
// Oracles: the rows' status before and after the restart, the server's
// probe-start / probe-end log (how many probes were open at once, and that
// every link was probed again), no "App restarted" error, files on disk.

const LIMIT = 2

type ProbeEvent = Extract<FixtureServerRequest, {kind: 'probe-start' | 'probe-end'}>

function probeEvents(fixtureServer: FixtureServer, videoIds: readonly string[]): ProbeEvent[] {
	const ids = new Set(videoIds)
	return fixtureServer.telemetry().requests.filter((request): request is ProbeEvent => (request.kind === 'probe-start' || request.kind === 'probe-end') && ids.has(request.videoId))
}

function starts(events: readonly ProbeEvent[]): string[] {
	return events.flatMap(event => (event.kind === 'probe-start' ? [event.videoId] : []))
}

// The most probes for these videos open at the server at once. A probe the
// quit cut short ends when its yt-dlp goes away.
function mostAtOnce(events: readonly ProbeEvent[]): number {
	let open = 0
	let most = 0
	for (const event of events) {
		open += event.kind === 'probe-start' ? 1 : -1
		most = Math.max(most, open)
	}
	return most
}

function rowsWithStatus(page: Page, status: string) {
	return page.locator(`[data-testid^="queue-manager-row-"][data-status="${status}"]`)
}

async function quickDownloadFromUrlTab(page: Page, url: string): Promise<void> {
	const input = page.locator('[data-testid="profiles-main-input"]')
	await input.fill(url)
	await page.locator('[data-testid="profiles-quick-download"]').click()
	await expect(input).toHaveValue('')
}

test('links still being checked at quit are checked again on the next launch, two at a time, and finish', async () => {
	test.setTimeout(240_000)
	const videoIds = FIXTURE_VIDEO_IDS.slice(0, 4)
	if (videoIds.length < 4) throw new Error('fixture catalog needs four videos')

	await withFixtureProductApp(
		{
			behavior: {metadataHeldIds: videoIds},
			settings: settings => {
				settings.common.concurrentProbes = LIMIT
			},
			userDataPrefix: 'arroxy-fixture-resume-probes-user-',
			outputPrefix: 'arroxy-fixture-resume-probes-out-'
		},
		async ({page, urls, fixtureServer, files, relaunch}) => {
			for (const id of videoIds) await quickDownloadFromUrlTab(page, urls.video(id))
			await page.locator('.downloads-tab-trigger').click()
			await expect(rowsWithStatus(page, 'probing')).toHaveCount(videoIds.length, {timeout: 15_000})
			await expect.poll(() => starts(probeEvents(fixtureServer, videoIds)).length, {timeout: 30_000, message: 'two probes reach the site before the quit'}).toBe(LIMIT)

			const beforeQuit = probeEvents(fixtureServer, videoIds).length
			const next = await relaunch()
			const resumed = (): ProbeEvent[] => probeEvents(fixtureServer, videoIds).slice(beforeQuit)

			await next.page.locator('.downloads-tab-trigger').click()
			await expect(rowsWithStatus(next.page, 'probing')).toHaveCount(videoIds.length, {timeout: 15_000})
			await expect(rowsWithStatus(next.page, 'error')).toHaveCount(0)
			await expect.poll(() => starts(resumed()).length, {timeout: 30_000, message: 'the next launch probes again, two at a time'}).toBe(LIMIT)

			fixtureServer.releaseMetadata()
			await expect(rowsWithStatus(next.page, 'done')).toHaveCount(videoIds.length, {timeout: 180_000})
			await expect.poll(() => files.mediaFiles('mp4').length, {timeout: 20_000}).toBe(videoIds.length)

			await expect(next.page.getByText('App restarted while fetching video details')).toHaveCount(0)
			expect(new Set(starts(resumed()))).toEqual(new Set(videoIds))
			expect(mostAtOnce(probeEvents(fixtureServer, videoIds))).toBe(LIMIT)
		}
	)
})
