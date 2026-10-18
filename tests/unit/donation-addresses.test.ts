import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vite-plus/test'
import {DONATION_ADDRESSES} from '@shared/constants.js'

// DONATE.md is the canonical, CI-pinned source of the addresses. The in-app
// donate dialog reads the constants, so they must never drift from it.
describe('DONATION_ADDRESSES', () => {
	const donate = readFileSync('DONATE.md', 'utf8')

	it.each(DONATION_ADDRESSES)('$id address matches DONATE.md', ({address}) => {
		expect(donate).toContain(address)
	})

	it('lists Bitcoin, USDT on Tron and Ethereum', () => {
		expect(DONATION_ADDRESSES.map(entry => entry.id)).toEqual(['btc', 'usdt-trc20', 'eth'])
	})
})
