// Downloads tab column widths. The table always fills its card, so a width is
// a share, not a size: each rendered column gets its share of the sum of the
// rendered columns' shares. Resizing trades width between a column and its
// right neighbour, so the dragged edge follows the pointer and no other column
// moves.

import type {QueueTableColumnId} from '@shared/schemas.js'

export type QueueColumnWidths = Record<QueueTableColumnId, number>

// The default visible set (all but Finished) adds up to 100.
export const DEFAULT_QUEUE_COLUMN_WIDTHS: QueueColumnWidths = {title: 21, status: 17, progressPercent: 9, formatLabel: 13, outputDir: 13, artifacts: 8, fileSize: 10, addedAt: 9, finishedAt: 9}

// Narrow enough to hide most of a label, wide enough to grab again.
const MIN_COLUMN_PX = 48

function totalShare(renderedIds: readonly QueueTableColumnId[], widths: QueueColumnWidths): number {
	return renderedIds.reduce((sum, id) => sum + widths[id], 0)
}

export function columnWidthPercents(renderedIds: readonly QueueTableColumnId[], widths: QueueColumnWidths): Partial<Record<QueueTableColumnId, number>> {
	const total = totalShare(renderedIds, widths)
	return Object.fromEntries(renderedIds.map(id => [id, total > 0 ? (widths[id] / total) * 100 : 100 / renderedIds.length]))
}

export interface ColumnPairResize {
	widths: QueueColumnWidths
	renderedIds: readonly QueueTableColumnId[]
	left: QueueTableColumnId
	right: QueueTableColumnId
	// Positive widens `left`, in the table's reading direction.
	deltaPx: number
	tableWidthPx: number
}

export function resizeColumnPair({widths, renderedIds, left, right, deltaPx, tableWidthPx}: ColumnPairResize): QueueColumnWidths {
	if (tableWidthPx <= 0) return widths
	const sharePerPx = totalShare(renderedIds, widths) / tableWidthPx
	const minShare = MIN_COLUMN_PX * sharePerPx
	const pair = widths[left] + widths[right]
	if (pair <= minShare * 2) return widths
	const nextLeft = Math.min(Math.max(widths[left] + deltaPx * sharePerPx, minShare), pair - minShare)
	return {...widths, [left]: nextLeft, [right]: pair - nextLeft}
}
