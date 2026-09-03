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

/** Stable public state and operations exposed by a table model. */
export interface ModelHandle<TRow, TInsert, TUpdate> {
	items: Ref<TRow[]>
	totalCount: Ref<number | null>
	loading: Ref<boolean>
	error: Ref<unknown>
	stale: Ref<boolean>
	getById(id: string | number, select?: string): Promise<TRow | null>
	create(payload: TInsert): Promise<TRow | null>
	update(id: string | number, payload: TUpdate): Promise<TRow | null>
	remove(id: string | number): Promise<void>
	fetch(query?: ModelQuery<string, Extract<keyof TRow, string>>): Promise<TRow[]>
	refresh(query?: ModelQuery<string, Extract<keyof TRow, string>>): Promise<TRow[]>
	invalidate(): void
	subscribe(): void
	unsubscribe(): void | Promise<void>
}
