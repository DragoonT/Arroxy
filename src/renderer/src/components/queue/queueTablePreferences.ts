import {z} from 'zod'
import {QUEUE_TABLE_COLUMN_IDS, queueTableColumnIdSchema, type QueueTableColumnId} from '@shared/schemas.js'
import {DEFAULT_QUEUE_COLUMN_WIDTHS} from './queueColumnWidths.js'

export type {QueueTableColumnId}

export function isQueueTableColumnId(value: unknown): value is QueueTableColumnId {
	return queueTableColumnIdSchema.safeParse(value).success
}

const STORAGE_KEY = 'arroxy.queueTablePreferences.v1'

// Persisted lists keep their valid items: a bad item is dropped, not the list.
function lenientList<T extends z.ZodType>(item: T): z.ZodType<Array<NonNullable<z.output<T>>>> {
	return z
		.array(item.nullable().catch(null))
		.catch([])
		.transform(items => items.filter((value): value is NonNullable<z.output<T>> => value !== null))
}

const sortingRuleSchema = z.object({id: queueTableColumnIdSchema, desc: z.boolean().catch(false)})

// A Set keeps first-seen order, so this dedupes and appends the columns the stored order lacks.
const columnOrderSchema = lenientList(queueTableColumnIdSchema).transform(ids => [...new Set([...ids, ...QUEUE_TABLE_COLUMN_IDS])])

// Title and status cannot be hidden, whatever storage says.
const lockedVisible = z
	.boolean()
	.catch(true)
	.transform((): boolean => true)
const shownByDefault = z.boolean().catch(true)
const columnVisibilityFieldsSchema = z.object({title: lockedVisible, status: lockedVisible, progressPercent: shownByDefault, formatLabel: shownByDefault, outputDir: shownByDefault, artifacts: shownByDefault, fileSize: shownByDefault, addedAt: shownByDefault, finishedAt: z.boolean().catch(false)} satisfies Record<
	QueueTableColumnId,
	z.ZodType<boolean, unknown>
>)
const columnVisibilitySchema = columnVisibilityFieldsSchema.catch(() => columnVisibilityFieldsSchema.parse({}))

// Widths are shares of the table (see queueColumnWidths), so any positive number is valid.
const width = (id: QueueTableColumnId): z.ZodType<number, unknown> => z.number().positive().catch(DEFAULT_QUEUE_COLUMN_WIDTHS[id])
const columnWidthFieldsSchema = z.object({
	title: width('title'),
	status: width('status'),
	progressPercent: width('progressPercent'),
	formatLabel: width('formatLabel'),
	outputDir: width('outputDir'),
	artifacts: width('artifacts'),
	fileSize: width('fileSize'),
	addedAt: width('addedAt'),
	finishedAt: width('finishedAt')
} satisfies Record<QueueTableColumnId, z.ZodType<number, unknown>>)
const columnWidthsSchema = columnWidthFieldsSchema.catch(() => columnWidthFieldsSchema.parse({}))

const preferenceFieldsSchema = z.object({sorting: lenientList(sortingRuleSchema), columnOrder: columnOrderSchema, columnVisibility: columnVisibilitySchema, columnWidths: columnWidthsSchema})

// Never fails: storage is untrusted, so every field falls back on its own.
const queueTablePreferencesSchema = preferenceFieldsSchema.catch(() => preferenceFieldsSchema.parse({})).transform(fields => ({version: 1 as const, ...fields}))

export type QueueTablePreferences = z.output<typeof queueTablePreferencesSchema>

export const DEFAULT_QUEUE_TABLE_PREFERENCES: QueueTablePreferences = {version: 1, sorting: [{id: 'addedAt', desc: true}], columnOrder: [...QUEUE_TABLE_COLUMN_IDS], columnVisibility: columnVisibilitySchema.parse({}), columnWidths: {...DEFAULT_QUEUE_COLUMN_WIDTHS}}

export function sanitizeQueueTablePreferences(value: unknown): QueueTablePreferences {
	return queueTablePreferencesSchema.parse(value)
}

export function loadQueueTablePreferences(storage: Pick<Storage, 'getItem'> = window.localStorage): QueueTablePreferences {
	try {
		const raw = storage.getItem(STORAGE_KEY)
		return raw ? sanitizeQueueTablePreferences(JSON.parse(raw)) : DEFAULT_QUEUE_TABLE_PREFERENCES
	} catch {
		return DEFAULT_QUEUE_TABLE_PREFERENCES
	}
}

export function saveQueueTablePreferences(preferences: QueueTablePreferences, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeQueueTablePreferences(preferences)))
}
