import type { Ref } from 'vue'
import type { OrderDirection, WhereClause } from './list'

// Keep operators extensible like PostgREST. Generated models type search/order
// columns, while runtime exposure validation protects automatic UI paths.
export type ModelWhere<_Column extends string = string> = WhereClause

/** Canonical query object accepted by generated table models. */
export interface ModelQuery<
	Include extends string = string,
	Column extends string = string,
> {
	/** Raw PostgREST select escape hatch. Prefer `include` for generated relations. */
	select?: string
	where?: ModelWhere<Column>
	orderBy?: Column | `${string}.${string}` | Partial<Record<Column | `${string}.${string}`, OrderDirection>>
	orderDirection?: OrderDirection
	orderForeignTable?: string
	limit?: number
	offset?: number
	search?: string
	searchColumns?: readonly Column[]
	include?: readonly Include[]
	/** Advanced store option: explicitly merge rows instead of replacing the current collection. */
	merge?: boolean
	/** Advanced store option overriding the configured TTL for this request. */
	staleTimeMs?: number
}

/** A mutation may target either the generated primary-key value or a row of the same model. */
export type ModelMutationTarget<
	TRow,
	TPrimaryKey extends Extract<keyof TRow, string>,
> = Extract<TRow[TPrimaryKey], string | number> | TRow

/** Stable public state and operations exposed by a table model. */
export interface ModelHandle<
	TRow,
	TInsert,
	TUpdate,
	TPrimaryKey extends Extract<keyof TRow, string> = Extract<keyof TRow, string>,
> {
	items: Ref<TRow[]>
	totalCount: Ref<number | null>
	loading: Ref<boolean>
	error: Ref<unknown>
	stale: Ref<boolean>
	getById(id: string | number, select?: string): Promise<TRow | null>
	create(payload: TInsert): Promise<TRow>
	update(target: ModelMutationTarget<TRow, TPrimaryKey>, payload: TUpdate): Promise<TRow | null>
	remove(target: ModelMutationTarget<TRow, TPrimaryKey>): Promise<void>
	fetch(query?: ModelQuery<string, Extract<keyof TRow, string>>): Promise<TRow[]>
	refresh(query?: ModelQuery<string, Extract<keyof TRow, string>>): Promise<TRow[]>
	invalidate(): void
	subscribe(): void
	unsubscribe(): void | Promise<void>
}
