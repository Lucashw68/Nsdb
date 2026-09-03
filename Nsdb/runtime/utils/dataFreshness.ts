import type { ListOptions } from '@lucashw68/nsdb/types/list'

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalize)
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, normalize(entry)]),
		)
	}
	return value
}

export function stableQueryKey(value: unknown): string {
	return JSON.stringify(normalize(value))
}

export function isComplexCollectionQuery(query: ListOptions): boolean {
	return !!(
		(query.where && Object.keys(query.where).length > 0)
		|| query.search
		|| (query.offset ?? 0) > 0
		|| query.orderForeignTable
		// Selecting a subset of scalar columns does not change membership. An
		// embedded PostgREST relation does, and cannot be maintained locally.
		|| (query.select?.includes('(') ?? false)
	)
}

export function sortCollection<T extends Record<string, any>>(
	rows: T[],
	query: ListOptions,
): T[] {
	if (!query.orderBy || query.orderForeignTable) return [...rows]
	const direction = query.orderDirection === 'desc' ? -1 : 1
	const column = query.orderBy
	return [...rows].sort((left, right) => {
		const a = left[column]
		const b = right[column]
		if (a == null && b == null) return 0
		if (a == null) return 1
		if (b == null) return -1
		return String(a).localeCompare(String(b), undefined, { numeric: true }) * direction
	})
}
