import type { ListOptions, WhereClause, WhereOperator } from '../types/list'

export type QueryBuilderLike = {
	[key: string]: unknown
	or: (expression: string) => QueryBuilderLike
	order: (column: string, options: Record<string, unknown>) => QueryBuilderLike
	range: (from: number, to: number) => QueryBuilderLike
	eq: (column: string, value: unknown) => QueryBuilderLike
	neq: (column: string, value: unknown) => QueryBuilderLike
	gt: (column: string, value: unknown) => QueryBuilderLike
	gte: (column: string, value: unknown) => QueryBuilderLike
	lt: (column: string, value: unknown) => QueryBuilderLike
	lte: (column: string, value: unknown) => QueryBuilderLike
	ilike: (column: string, value: unknown) => QueryBuilderLike
	in: (column: string, value: readonly unknown[]) => QueryBuilderLike
}

export function escapePostgrestSearchTerm(value: string) {
	return value
		.replace(/[\\%_]/g, match => `\\${match}`)
		.replace(/[(),]/g, ' ')
		.trim()
}

export function applySearch<T extends QueryBuilderLike>(query: T, options: ListOptions): T {
	const search = options.search?.trim()
	if (!search) return query

	const columns = [...new Set((options.searchColumns ?? []).map(column => column.trim()).filter(Boolean))]
	if (columns.length === 0) return query

	const term = escapePostgrestSearchTerm(search)
	if (!term) return query

	const expression = columns.map(column => `${column}.ilike.%${term}%`).join(',')
	return query.or(expression) as T
}

export function normalizePagination(options: Pick<ListOptions, 'limit' | 'offset'>) {
	const limit = options.limit ?? 100
	const offset = options.offset ?? 0

	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new RangeError('[nsdb] limit must be a positive safe integer.')
	}
	if (!Number.isSafeInteger(offset) || offset < 0) {
		throw new RangeError('[nsdb] offset must be a non-negative safe integer.')
	}

	return { limit, offset }
}

export function applyListOptions<T extends QueryBuilderLike>(query: T, options: ListOptions): T {
	const orderBy = options.orderBy
	const orderDirection = options.orderDirection ?? 'asc'
	const { limit, offset } = normalizePagination(options)
	let finalQuery: QueryBuilderLike = query

	if (orderBy && options.orderForeignTable) {
		finalQuery = finalQuery.order(orderBy, {
			ascending: orderDirection === 'asc',
			referencedTable: options.orderForeignTable,
		})
	} else if (orderBy) {
		finalQuery = finalQuery.order(orderBy, { ascending: orderDirection === 'asc' })
	}

	return finalQuery.range(offset, offset + limit - 1) as T
}

export function applySingleFilter<T extends QueryBuilderLike>(
	query: T,
	column: string,
	filter: WhereOperator,
): T {
	switch (filter.op) {
		case 'eq': return query.eq(column, filter.value) as T
		case 'neq': return query.neq(column, filter.value) as T
		case 'gt': return query.gt(column, filter.value) as T
		case 'gte': return query.gte(column, filter.value) as T
		case 'lt': return query.lt(column, filter.value) as T
		case 'lte': return query.lte(column, filter.value) as T
		case 'ilike': return query.ilike(column, filter.value) as T
		case 'in': {
			if (!Array.isArray(filter.value)) {
				throw new TypeError(`[nsdb] The "in" filter for "${column}" requires an array value.`)
			}
			return query.in(column, filter.value) as T
		}
		default: throw new TypeError(`[nsdb] Unsupported filter operator for "${column}".`)
	}
}

export function applyWhereFilters<T extends QueryBuilderLike>(query: T, where?: WhereClause): T {
	if (!where || Object.keys(where).length === 0) return query

	let finalQuery: QueryBuilderLike = query
	for (const [column, rawValue] of Object.entries(where)) {
		if (Array.isArray(rawValue)) {
			const containsOperators = rawValue.some(
				part => part != null && typeof part === 'object' && 'op' in part,
			)
			if (!containsOperators) {
				finalQuery = finalQuery.in(column, rawValue)
				continue
			}

			for (const part of rawValue) {
				if (!part || typeof part !== 'object' || !('op' in part)) {
					throw new TypeError(`[nsdb] Filter array for "${column}" cannot mix values and operators.`)
				}
				finalQuery = applySingleFilter(finalQuery, column, part as WhereOperator)
			}
			continue
		}

		if (rawValue && typeof rawValue === 'object' && 'op' in rawValue) {
			finalQuery = applySingleFilter(finalQuery, column, rawValue as WhereOperator)
			continue
		}

		finalQuery = finalQuery.eq(column, rawValue)
	}

	return finalQuery as T
}
