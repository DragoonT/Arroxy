// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vite-plus/test'
import {useAppStore} from '@renderer/store/useAppStore.js'
import type {HeldProbe} from '@shared/types.js'
import {buildMockAppApi} from '../shared/mockAppApi.js'

// The renderer mirrors the probes main holds for a cooldown (#664): the
// initial read fills the list, and a pushed list wins over a read that
// answers after it.

const HELD: HeldProbe[] = [{owner: 'row-1', site: 'youtube'}]

function deferred<T>(): {promise: Promise<T>; resolve: (value: T) => void} {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(res => (resolve = res))
	return {promise, resolve}
}

beforeEach(() => {
	window.appApi = buildMockAppApi()
	useAppStore.setState({heldProbes: []})
})

describe('held probes in the renderer', () => {
	it('takes the initial list main reports', async () => {
		vi.mocked(window.appApi.siteRequests.getHeldProbes).mockResolvedValue({ok: true, data: HELD})
		useAppStore.getState().bindSiteCooldowns()
		await vi.waitFor(() => expect(useAppStore.getState().heldProbes).toEqual(HELD))
	})

	it('keeps a pushed list over an initial read that answers later', async () => {
		const read = deferred<{ok: true; data: HeldProbe[]}>()
		vi.mocked(window.appApi.siteRequests.getHeldProbes).mockReturnValue(read.promise)
		let push: ((held: HeldProbe[]) => void) | undefined
		vi.mocked(window.appApi.siteRequests.onHeldProbesChanged).mockImplementation(listener => {
			push = listener
			return () => undefined
		})
		useAppStore.getState().bindSiteCooldowns()
		push?.([])
		read.resolve({ok: true, data: HELD})
		await read.promise
		await Promise.resolve()
		expect(useAppStore.getState().heldProbes).toEqual([])
	})
})
