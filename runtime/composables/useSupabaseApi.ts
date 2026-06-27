import { useSupabaseClient } from '#imports'
import type {
	ListOptions,
	OrderDirection,
	FindOptions,
	WhereClause,
	WhereOperator
} from '@lucashw68/nsdb/types/list'

type SupabaseFrom = ReturnType<ReturnType<typeof useSupabaseClient>['from']>
type QueryBuilder = any
type MutationPayload = Record<string, unknown> | Record<string, unknown>[]

export interface SupabaseApiSuccess<T> {
	success: true
	error: undefined
	data: T | null
	count: number | null
}

export interface SupabaseApiFailure<T> {
	success: false
	error: unknown
	data: T
	count: number | null
}

export type SupabaseApiResponse<T> = SupabaseApiSuccess<T> | SupabaseApiFailure<T>
export type SupabaseApiListResponse<T> = SupabaseApiResponse<T[]>

function escapeOrValueForPostgrestIlike(v: string) {
	// PostgREST "or" syntax likes: col.ilike.%term%
	// We just remove commas/parentheses which can break the expression.
	return v.replace(/[(),]/g, ' ').trim()
}

function applySearch(query: QueryBuilder, options: ListOptions) {
	const search = options.search?.trim()
	if (!search) return query

	const cols = (options.searchColumns ?? []).filter(Boolean)
	if (cols.length === 0) return query

	const term = escapeOrValueForPostgrestIlike(search)
	if (!term) return query

	// ex: title.ilike.%abc%,author.ilike.%abc%
	const orExpr = cols.map(c => `${c}.ilike.%${term}%`).join(',')
	return query.or(orExpr)
}

/**
 * Applique tri + pagination.
 */
function applyListOptions(query: SupabaseFrom, options: ListOptions) {
	const {
		orderBy = 'id',
		orderDirection = 'asc',
		orderForeignTable,
		limit = 100,
		offset = 0,
	} = options

	let finalQuery: QueryBuilder = query

	// ✅ Embedded order si relation
	if (orderForeignTable) {
		finalQuery = finalQuery.order(orderBy, {
			ascending: orderDirection === 'asc',
			referencedTable: orderForeignTable,
		})
	} else {
		finalQuery = finalQuery.order(orderBy, { ascending: orderDirection === 'asc' })
	}

	finalQuery = finalQuery.range(offset, offset + limit - 1)
	return finalQuery
}

function applySingleFilter(query: QueryBuilder, column: string, filter: WhereOperator) {
	switch (filter.op) {
		case 'eq': return query.eq(column, filter.value)
		case 'neq': return query.neq(column, filter.value)
		case 'gt': return query.gt(column, filter.value)
		case 'gte': return query.gte(column, filter.value)
		case 'lt': return query.lt(column, filter.value)
		case 'lte': return query.lte(column, filter.value)
		case 'ilike': return query.ilike(column, filter.value)
		case 'in': return query.in(column, filter.value)
		default: return query.eq(column, filter.value)
	}
}

function applyWhereFilters(query: SupabaseFrom, where?: WhereClause) {
	if (!where || Object.keys(where).length === 0) return query

	let finalQuery: QueryBuilder = query

	for (const [column, rawValue] of Object.entries(where)) {
		if (Array.isArray(rawValue)) {
			for (const part of rawValue) {
				if (part && typeof part === 'object' && 'op' in part) {
					finalQuery = applySingleFilter(finalQuery, column, part as WhereOperator)
				} else {
					finalQuery = finalQuery.eq(column, part)
				}
			}
			continue
		}

		if (rawValue && typeof rawValue === 'object' && 'op' in rawValue) {
			finalQuery = applySingleFilter(finalQuery, column, rawValue as WhereOperator)
			continue
		}

		finalQuery = finalQuery.eq(column, rawValue)
	}

	return finalQuery
}

/** #########################################################
 * Handle Responses
 * ##########################################################
*/

function handleResponse<T>(
	payload: { data: T | null; error: unknown; count?: number | null },
	context: string
): SupabaseApiResponse<T> {
	const { data, error, count } = payload

	if (error) {
		console.error(`❌ [${context}]`, error)
		return {
			success: false as const,
			error,
			data: undefined as unknown as T,
			count: count ?? null,
		}
	}

	return {
		success: true as const,
		error: undefined,
		data,
		count: count ?? null,
	}
}

function handleListResponse<T>(
	data: T[] | null,
	count: number | null,
	error: unknown,
	context: string
) {
	if (error) {
		console.error(`❌ [${context}]`, error)
		return {
		success: false as const,
		error,
		data: [] as T[],
		count: null as number | null,
		}
	}

	return {
		success: true as const,
		error: undefined,
		data: (data ?? []) as T[],
		count: typeof count === 'number' ? count : null,
	}
}

/** #########################################################
 * API Methods
 * all, show, create, update, destroy, upsert
 * allByProperty, showByProperty, updateByProperty, deleteByProperty
 * count
 * find, findOne
 * ##########################################################
*/

export const useSupabaseApi = () => {
	const supabaseClient = useSupabaseClient?.()
	if (!supabaseClient) {
		throw new Error('[nsdb] Supabase client not found. Install @nuxtjs/supabase.')
	}

	async function all<T = any>(
		resource: string,
		selectOrOptions: string | ListOptions = '*',
		orderBy: string = 'id',
		orderDirection: OrderDirection = 'asc',
		limit: number = 100,
		offset: number = 0
	) {
		let selectClause = '*'
		let options: ListOptions = {}

		if (typeof selectOrOptions === 'string') {
			selectClause = selectOrOptions
			options = { orderBy, orderDirection, limit, offset }
		} else {
			selectClause = selectOrOptions.select ?? '*'
			options = {
				select: selectClause,
				where: selectOrOptions.where,
				orderBy: selectOrOptions.orderBy ?? orderBy,
				orderDirection: selectOrOptions.orderDirection ?? orderDirection,
				orderForeignTable: selectOrOptions.orderForeignTable,
				limit: selectOrOptions.limit ?? limit,
				offset: selectOrOptions.offset ?? offset,
				search: selectOrOptions.search,
				searchColumns: selectOrOptions.searchColumns,
			}
		}

		let q: any = supabaseClient.from(resource).select(selectClause, { count: 'exact' })
		q = applyWhereFilters(q, options.where)
		q = applySearch(q, options)
		q = applyListOptions(q, options)

		const { data, error, count } = await q
		return handleListResponse<T>(data, count ?? null, error, `ALL ${resource}`)
	}

	async function show<T = any>(resource: string, id: string | number, select: string = '*') {
		const { data, error } = await supabaseClient
			.from(resource)
			.select(select)
			.eq('id', id)
			.limit(1)
			.single()

		return handleResponse<T>({ data, error }, `SHOW ${resource}/${id}`)
	}

	async function create<T = any>(resource: string, payload: MutationPayload) {
		const { data, error } = await (supabaseClient.from(resource) as QueryBuilder).insert(payload).select().single()
		return handleResponse<T>({ data, error }, `CREATE ${resource}`)
	}

	async function update<T = any>(resource: string, id: string | number, payload: MutationPayload) {
		const { data, error } = await (supabaseClient.from(resource) as QueryBuilder).update(payload).eq('id', id).select()
		return handleResponse<T | T[]>({ data, error }, `UPDATE ${resource}/${id}`)
	}

	async function destroy(resource: string, id: string | number) {
		const { data, error } = await supabaseClient.from(resource).delete().eq('id', id)
		return handleResponse({ data, error }, `DELETE ${resource}/${id}`)
	}

	async function upsert<T = any>(resource: string, payload: MutationPayload, options: { onConflict?: string } = {}) {
		let q: QueryBuilder = (supabaseClient.from(resource) as QueryBuilder).upsert(payload).select()
		if (options.onConflict) q = q.onConflict(options.onConflict)
		const { data, error } = await q
		return handleResponse<T | T[]>({ data, error }, `UPSERT ${resource}`)
	}

	async function allByProperty<T = any>(
		resource: string,
		propertyName: string,
		propertyValue: string | number,
		selectOrOptions: string | ListOptions = '*',
		orderBy: string = 'id',
		orderDirection: OrderDirection = 'asc',
		limit: number = 10,
		offset: number = 0
	) {
		let selectClause = '*'
		let options: ListOptions = {}

		if (typeof selectOrOptions === 'string') {
			selectClause = selectOrOptions
			options = { orderBy, orderDirection, limit, offset }
		} else {
			selectClause = selectOrOptions.select ?? '*'
			options = {
				select: selectClause,
				where: selectOrOptions.where,
				orderBy: selectOrOptions.orderBy ?? orderBy,
				orderDirection: selectOrOptions.orderDirection ?? orderDirection,
				orderForeignTable: selectOrOptions.orderForeignTable,
				limit: selectOrOptions.limit ?? limit,
				offset: selectOrOptions.offset ?? offset,
				search: selectOrOptions.search,
				searchColumns: selectOrOptions.searchColumns,
			}
		}

		let q: QueryBuilder = supabaseClient
			.from(resource)
			.select(selectClause, { count: 'exact' })
			.eq(propertyName, propertyValue)

		q = applyWhereFilters(q, options.where)
		q = applySearch(q, options)
		q = applyListOptions(q, options)

		const { data, error, count } = await q
		return handleListResponse<T>(data, count ?? null, error, `ALL ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function showByProperty<T = any>(
		resource: string,
		propertyName: string,
		propertyValue: string | number,
		select: string = '*'
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.select(select)
			.eq(propertyName, propertyValue)
			.limit(1)
			.single()

		return handleResponse<T>({ data, error }, `SHOW ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function updateByProperty<T = any>(resource: string, propertyName: string, propertyValue: string | number, payload: MutationPayload) {
		const { data, error } = await (supabaseClient.from(resource) as QueryBuilder).update(payload).eq(propertyName, propertyValue).select()
		return handleResponse<T | T[]>({ data, error }, `UPDATE ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function deleteByProperty(resource: string, propertyName: string, propertyValue: string | number) {
		const { data, error } = await supabaseClient.from(resource).delete().eq(propertyName, propertyValue)
		return handleResponse({ data, error }, `DELETE ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function count(resource: string, where?: { property: string; value: string | number }) {
		let q: QueryBuilder = supabaseClient.from(resource).select('*', { count: 'exact', head: true })
		if (where) q = q.eq(where.property, where.value)
		const { count, error } = await q
		return handleResponse<number | null>({ data: count ?? null, error }, `COUNT ${resource}`)
	}

	async function find<T = any>(resource: string, options: FindOptions) {
		const {
			select = '*',
			where,
			orderBy,
			orderDirection,
			orderForeignTable,
			limit,
			offset,
			search,
			searchColumns,
		} = options

		let q: QueryBuilder = supabaseClient.from(resource).select(select, { count: 'exact' })
		q = applyWhereFilters(q, where)
		q = applySearch(q, { search, searchColumns })
		q = applyListOptions(q, { orderBy, orderDirection, orderForeignTable, limit, offset })

		const { data, error, count } = await q
		return handleListResponse<T>(data, count ?? null, error, `FIND ${resource}`)
	}

	async function findOne<T = any>(resource: string, options: FindOptions) {
		const { select = '*', where } = options
		let q: QueryBuilder = supabaseClient.from(resource).select(select)
		q = applyWhereFilters(q, where)
		const { data, error } = await q.limit(1).single()
		return handleResponse<T>({ data, error }, `FIND ONE ${resource}`)
	}

	return {
		all,
		show,
		create,
		update,
		destroy,
		upsert,

		allByProperty,
		showByProperty,
		updateByProperty,
		deleteByProperty,

		count,

		find,
		findOne,
	}
}
