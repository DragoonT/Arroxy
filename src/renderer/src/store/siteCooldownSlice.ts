import type {Result} from '@shared/result.js'
import type {GetState, SetState, SiteCooldownSlice} from './types.js'

let unbindSiteCooldowns: (() => void) | null = null
let siteCooldownBinding = 0

// Follows a list main pushes: a pushed list always wins over the initial read,
// which may answer late. Returns the unsubscribe.
function follow<T>(subscribe: (listener: (value: T) => void) => () => void, read: () => Promise<Result<T>>, apply: (value: T) => void, binding: number, what: string): () => void {
	let pushed = false
	const unsubscribe = subscribe(value => {
		pushed = true
		apply(value)
	})
	read().then(
		result => {
			if (result.ok && binding === siteCooldownBinding && !pushed) apply(result.data)
		},
		(err: unknown) => console.warn(`[site-requests] initial ${what} read failed`, err)
	)
	return unsubscribe
}

// Mirrors main's rate-limit cooldowns (SiteRequestState) and the probes they
// hold (ProbeSlots): main decides when a site may be asked again; the renderer
// only shows it and asks for "Try now".
export function createSiteCooldownSlice(set: SetState, _get: GetState): SiteCooldownSlice {
	return {
		siteCooldowns: [],
		heldProbes: [],

		bindSiteCooldowns: () => {
			unbindSiteCooldowns?.()
			const binding = ++siteCooldownBinding
			const {siteRequests} = window.appApi
			const unbindCooldowns = follow(
				listener => siteRequests.onCooldownsChanged(listener),
				() => siteRequests.getCooldowns(),
				siteCooldowns => set({siteCooldowns}),
				binding,
				'cooldown'
			)
			const unbindHeld = follow(
				listener => siteRequests.onHeldProbesChanged(listener),
				() => siteRequests.getHeldProbes(),
				heldProbes => set({heldProbes}),
				binding,
				'held probe'
			)
			unbindSiteCooldowns = () => {
				unbindCooldowns()
				unbindHeld()
			}
		},

		tryRateLimitedSiteNow: async site => {
			const result = await window.appApi.siteRequests.tryNow(site)
			if (!result.ok) console.warn('[site-requests] try now failed', result.error)
		}
	}
}
