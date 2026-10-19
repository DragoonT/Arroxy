import {describe, expect, it} from 'vite-plus/test'
import {DEFAULT_QUEUE_TABLE_PREFERENCES, loadQueueTablePreferences, saveQueueTablePreferences, sanitizeQueueTablePreferences} from '@renderer/components/queue/queueTablePreferences.js'

describe('queue table preferences', () => {
	it('defaults Added visible and Finished hidden', () => {
		expect(DEFAULT_QUEUE_TABLE_PREFERENCES.columnVisibility).toMatchObject({title: true, status: true, addedAt: true, finishedAt: false})
		expect(DEFAULT_QUEUE_TABLE_PREFERENCES.columnOrder).toEqual(['title', 'status', 'progressPercent', 'formatLabel', 'outputDir', 'artifacts', 'fileSize', 'addedAt', 'finishedAt'])
		expect(DEFAULT_QUEUE_TABLE_PREFERENCES.sorting).toEqual([{id: 'addedAt', desc: true}])
	})

	it('drops unknown persisted columns and keeps locked columns visible', () => {
		expect(
			sanitizeQueueTablePreferences({
				version: 1,
				sorting: [
					{id: 'bogus', desc: true},
					{id: 'finishedAt', desc: true}
				],
				columnOrder: ['finishedAt', 'bogus', 'title'],
				columnVisibility: {title: false, status: false, formatLabel: false, bogus: true}
			})
		).toEqual({
			version: 1,
			sorting: [{id: 'finishedAt', desc: true}],
			columnOrder: ['finishedAt', 'title', 'status', 'progressPercent', 'formatLabel', 'outputDir', 'artifacts', 'fileSize', 'addedAt'],
			columnVisibility: {title: true, status: true, progressPercent: true, formatLabel: false, outputDir: true, artifacts: true, fileSize: true, addedAt: true, finishedAt: false},
			columnWidths: DEFAULT_QUEUE_TABLE_PREFERENCES.columnWidths
		})
	})

	it('falls back field by field when persisted values have the wrong shape', () => {
		expect(sanitizeQueueTablePreferences({sorting: 'addedAt', columnOrder: {}, columnVisibility: [true]})).toEqual({
			version: 1,
			sorting: [],
			columnOrder: DEFAULT_QUEUE_TABLE_PREFERENCES.columnOrder,
			columnVisibility: DEFAULT_QUEUE_TABLE_PREFERENCES.columnVisibility,
			columnWidths: DEFAULT_QUEUE_TABLE_PREFERENCES.columnWidths
		})
		expect(sanitizeQueueTablePreferences('garbage')).toEqual({version: 1, sorting: [], columnOrder: DEFAULT_QUEUE_TABLE_PREFERENCES.columnOrder, columnVisibility: DEFAULT_QUEUE_TABLE_PREFERENCES.columnVisibility, columnWidths: DEFAULT_QUEUE_TABLE_PREFERENCES.columnWidths})
		expect(sanitizeQueueTablePreferences(null)).toEqual(sanitizeQueueTablePreferences({}))
	})

	it('keeps valid entries next to invalid ones', () => {
		expect(sanitizeQueueTablePreferences({sorting: [null, {id: 'title'}, {id: 'status', desc: 'yes'}, {id: 'fileSize', desc: true}], columnOrder: ['status', 7, 'status', 'title', null], columnVisibility: {outputDir: 'no', finishedAt: true, fileSize: false}})).toEqual({
			version: 1,
			sorting: [
				{id: 'title', desc: false},
				{id: 'status', desc: false},
				{id: 'fileSize', desc: true}
			],
			columnOrder: ['status', 'title', 'progressPercent', 'formatLabel', 'outputDir', 'artifacts', 'fileSize', 'addedAt', 'finishedAt'],
			columnVisibility: {...DEFAULT_QUEUE_TABLE_PREFERENCES.columnVisibility, finishedAt: true, fileSize: false},
			columnWidths: DEFAULT_QUEUE_TABLE_PREFERENCES.columnWidths
		})
	})

	it('defaults column widths to shares that fill the table and keeps valid persisted widths', () => {
		const {columnWidths, columnVisibility} = DEFAULT_QUEUE_TABLE_PREFERENCES
		const shownByDefault = Object.entries(columnWidths).filter(([id]) => columnVisibility[id as keyof typeof columnVisibility])
		expect(shownByDefault.reduce((sum, [, width]) => sum + width, 0)).toBe(100)

		expect(sanitizeQueueTablePreferences({columnWidths: {title: 42.5, status: -3, outputDir: 'wide', fileSize: Number.POSITIVE_INFINITY, bogus: 10}}).columnWidths).toEqual({...columnWidths, title: 42.5})
		expect(sanitizeQueueTablePreferences({columnWidths: 'wide'}).columnWidths).toEqual(columnWidths)
	})

	it('loads defaults for missing or unparsable storage and round-trips saved preferences', () => {
		expect(loadQueueTablePreferences({getItem: () => null})).toEqual(DEFAULT_QUEUE_TABLE_PREFERENCES)
		expect(loadQueueTablePreferences({getItem: () => '{not json'})).toEqual(DEFAULT_QUEUE_TABLE_PREFERENCES)

		let stored = ''
		const preferences = {...DEFAULT_QUEUE_TABLE_PREFERENCES, sorting: [{id: 'title' as const, desc: false}]}
		saveQueueTablePreferences(preferences, {
			setItem: (_key, value) => {
				stored = value
			}
		})
		expect(loadQueueTablePreferences({getItem: () => stored})).toEqual(preferences)
	})
})
