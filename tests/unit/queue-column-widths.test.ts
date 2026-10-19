import {describe, expect, it} from 'vite-plus/test'
import {DEFAULT_QUEUE_COLUMN_WIDTHS, columnWidthPercents, resizeColumnPair} from '@renderer/components/queue/queueColumnWidths.js'

describe('queue column widths', () => {
	it('shares the whole table between the rendered columns only', () => {
		const percents = columnWidthPercents(['title', 'status', 'artifacts'], {...DEFAULT_QUEUE_COLUMN_WIDTHS, title: 50, status: 30, artifacts: 20, fileSize: 999})

		expect(percents).toEqual({title: 50, status: 30, artifacts: 20})
	})

	it('rescales shares when a column is hidden', () => {
		const percents = columnWidthPercents(['title', 'status'], {...DEFAULT_QUEUE_COLUMN_WIDTHS, title: 30, status: 10})

		expect(percents).toEqual({title: 75, status: 25})
	})

	it('moves width between two neighbours and leaves every other column alone', () => {
		const widths = {...DEFAULT_QUEUE_COLUMN_WIDTHS, title: 40, status: 40, progressPercent: 20}
		// The rendered columns share 100 units over 1000px, so 100px is 10 units.
		const next = resizeColumnPair({widths, renderedIds: ['title', 'status', 'progressPercent'], left: 'title', right: 'status', deltaPx: 100, tableWidthPx: 1000})

		expect(next).toEqual({...widths, title: 50, status: 30})
	})

	it('narrows the left column when dragged back', () => {
		const widths = {...DEFAULT_QUEUE_COLUMN_WIDTHS, title: 40, status: 40, progressPercent: 20}
		const next = resizeColumnPair({widths, renderedIds: ['title', 'status', 'progressPercent'], left: 'title', right: 'status', deltaPx: -100, tableWidthPx: 1000})

		expect(next.title).toBe(30)
		expect(next.status).toBe(50)
	})

	it('never squeezes either neighbour below the minimum column width', () => {
		const widths = {...DEFAULT_QUEUE_COLUMN_WIDTHS, title: 40, status: 40, progressPercent: 20}
		const renderedIds = ['title', 'status', 'progressPercent'] as const
		const wider = resizeColumnPair({widths, renderedIds, left: 'title', right: 'status', deltaPx: 5000, tableWidthPx: 1000})
		const narrower = resizeColumnPair({widths, renderedIds, left: 'title', right: 'status', deltaPx: -5000, tableWidthPx: 1000})

		expect(wider.status * 10).toBeCloseTo(48)
		expect(wider.title + wider.status).toBeCloseTo(80)
		expect(narrower.title * 10).toBeCloseTo(48)
		expect(narrower.title + narrower.status).toBeCloseTo(80)
	})

	it('ignores a resize it cannot measure', () => {
		const widths = {...DEFAULT_QUEUE_COLUMN_WIDTHS}

		expect(resizeColumnPair({widths, renderedIds: ['title', 'status'], left: 'title', right: 'status', deltaPx: 50, tableWidthPx: 0})).toBe(widths)
	})
})
