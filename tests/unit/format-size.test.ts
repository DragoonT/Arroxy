// @vitest-environment node
import {describe, expect, it} from 'vite-plus/test'
import {compactSize, humanBitrate, humanSize} from '@shared/format.js'

describe('humanSize', () => {
	it('names 1024-based sizes with binary units and keeps one decimal', () => {
		expect(humanSize(1536)).toBe('1.5 KiB')
		expect(humanSize(143_250_432)).toBe('136.6 MiB')
		expect(humanSize(3 * 1024 ** 3)).toBe('3.0 GiB')
		expect(humanSize(1023 * 1024 ** 2)).toBe('1023.0 MiB')
	})

	it('formats the number for the UI locale', () => {
		expect(humanSize(143_250_432, 'de')).toBe('136,6 MiB')
		expect(humanSize(1023 * 1024 ** 2, 'de')).toBe('1.023,0 MiB')
	})
})

describe('compactSize', () => {
	it('uses binary units and about three significant digits', () => {
		expect(compactSize(512)).toBe('512 B')
		expect(compactSize(1536)).toBe('1.5 KiB')
		expect(compactSize(143_250_432)).toBe('137 MiB')
		expect(compactSize(3 * 1024 ** 3)).toBe('3 GiB')
		expect(compactSize(1023 * 1024 ** 2)).toBe('1023 MiB')
	})

	it('formats the number for the UI locale', () => {
		expect(compactSize(1536, 'de')).toBe('1,5 KiB')
	})
})

describe('humanBitrate', () => {
	it('says kbps below a megabit and Mbps with one decimal above', () => {
		expect(humanBitrate(850.4)).toBe('850 kbps')
		expect(humanBitrate(2645.9)).toBe('2.6 Mbps')
		expect(humanBitrate(12_000)).toBe('12.0 Mbps')
	})

	it('formats the number for the UI locale', () => {
		expect(humanBitrate(2645.9, 'de')).toBe('2,6 Mbps')
		expect(humanBitrate(1500, 'de')).toBe('1,5 Mbps')
	})
})
