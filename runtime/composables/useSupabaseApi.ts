import { useSupabaseClient } from '#imports'

export type OrderDirection = 'asc' | 'desc'

export interface ListOptions {
	select?: string
	orderBy?: string
	orderDirection?: OrderDirection

	/**
	 * Tri relationnel : ex orderBy='title', orderForeignTable='book'
	 * => order=book(title).asc (embedded order)
	 */
	orderForeignTable?: string

	limit?: number
	offset?: number

	/**
	 * Recherche texte simple (ilike) via OR sur plusieurs colonnes.
	 * Exemple:
	 *   search: 'clover'
	 *   searchColumns: ['title', 'author', 'book.title']
	 */
	search?: string
	searchColumns?: string[]
}

export interface WhereOperator {
	op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'
	value: any
}

export type WhereValue = any | WhereOperator | WhereOperator[]
export type WhereClause = Record<string, WhereValue>

export interface FindOptions extends ListOptions {
	where?: WhereClause
}

type SupabaseFrom = ReturnType<ReturnType<typeof useSupabaseClient>['from']>

function escapeOrValueForPostgrestIlike(v: string) {
	// PostgREST "or" syntax likes: col.ilike.%term%
	// We just remove commas/parentheses which can break the expression.
	return v.replace(/[(),]/g, ' ').trim()
}

function applySearch(query: any, options: ListOptions) {
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

	let finalQuery: any = query

	// ✅ Embedded order si relation
	if (orderForeignTable) {
		const embeddedKey = `${orderForeignTable}(${orderBy})`
		finalQuery = finalQuery.order(embeddedKey, { ascending: orderDirection === 'asc' })
	} else {
		finalQuery = finalQuery.order(orderBy, { ascending: orderDirection === 'asc' })
	}

	finalQuery = finalQuery.range(offset, offset + limit - 1)
	return finalQuery
}

function applySingleFilter(query: any, column: string, filter: WhereOperator) {
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

	let finalQuery: any = query

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

function handleResponse<T>(payload: { data: T | null; error: any; count?: number | null }, context: string) {
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
	error: any,
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

	async function create<T = any>(resource: string, payload: any) {
		const { data, error } = await supabaseClient.from(resource).insert(payload).select().single()
		return handleResponse<T>({ data, error }, `CREATE ${resource}`)
	}

	async function update<T = any>(resource: string, id: string | number, payload: any) {
		const { data, error } = await supabaseClient.from(resource).update(payload).eq('id', id).select()
		return handleResponse<T | T[]>({ data, error }, `UPDATE ${resource}/${id}`)
	}

	async function destroy(resource: string, id: string | number) {
		const { data, error } = await supabaseClient.from(resource).delete().eq('id', id)
		return handleResponse({ data, error }, `DELETE ${resource}/${id}`)
	}

	async function upsert<T = any>(resource: string, payload: any, options: { onConflict?: string } = {}) {
		let q: any = supabaseClient.from(resource).upsert(payload).select()
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
				orderBy: selectOrOptions.orderBy ?? orderBy,
				orderDirection: selectOrOptions.orderDirection ?? orderDirection,
				orderForeignTable: selectOrOptions.orderForeignTable,
				limit: selectOrOptions.limit ?? limit,
				offset: selectOrOptions.offset ?? offset,
				search: selectOrOptions.search,
				searchColumns: selectOrOptions.searchColumns,
			}
		}

		let q: any = supabaseClient
			.from(resource)
			.select(selectClause, { count: 'exact' })
			.eq(propertyName, propertyValue)

		q = applySearch(q, options)
		q = applyListOptions(q, options)

		const { data, error, count } = await q
		return handleResponse<T[]>({ data, error, count }, `ALL ${resource} WHERE ${propertyName}=${propertyValue}`)
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

	async function updateByProperty<T = any>(resource: string, propertyName: string, propertyValue: string | number, payload: any) {
		const { data, error } = await supabaseClient.from(resource).update(payload).eq(propertyName, propertyValue).select()
		return handleResponse<T | T[]>({ data, error }, `UPDATE ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function deleteByProperty(resource: string, propertyName: string, propertyValue: string | number) {
		const { data, error } = await supabaseClient.from(resource).delete().eq(propertyName, propertyValue)
		return handleResponse({ data, error }, `DELETE ${resource} WHERE ${propertyName}=${propertyValue}`)
	}

	async function count(resource: string, where?: { property: string; value: string | number }) {
		let q: any = supabaseClient.from(resource).select('*', { count: 'exact', head: true })
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

		let q: any = supabaseClient.from(resource).select(select, { count: 'exact' })
		q = applyWhereFilters(q, where)
		q = applySearch(q, { search, searchColumns })
		q = applyListOptions(q, { orderBy, orderDirection, orderForeignTable, limit, offset })

		const { data, error, count } = await q
		return handleListResponse<T>(data, count ?? null, error, `FIND ${resource}`)
	}

	async function findOne<T = any>(resource: string, options: FindOptions) {
		const { select = '*', where } = options
		let q: any = supabaseClient.from(resource).select(select)
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
