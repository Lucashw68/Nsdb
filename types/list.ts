export type Column = {
	key: string
	label: string
	format?: (value: unknown, row: Record<string, unknown>) => string
}

export type NsdbTableClasses = {
	wrapper: string
	headerWrapper: string
	headerTitle: string
	headerSubtitle: string
	toolbar: string
	searchInput: string
	error: string
	tableContainer: string
	table: string
	thead: string
	theadRow: string
	th: string
	actionsTh: string
	loadingCell: string
	emptyCell: string
	bodyRow: string
	td: string
	actionsTd: string
	deleteButton: string
	footer: string
	pagination: string
	pageButton: string
	pageButtonActive: string
	pageButtonDisabled: string
}

/** #########################################################
 * Filter & Sorting
 * ##########################################################
*/

export type OrderDirection = 'asc' | 'desc'

export type SortState = {
	key: string | null
	direction: OrderDirection | null
}

export interface ListOptions {
	select?: string
	where?: WhereClause
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
	searchColumns?: readonly string[]
}

export interface WhereOperator {
	op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'
	value: unknown
}

export type WherePrimitive = string | number | boolean | null
export type WhereValue = WherePrimitive | WherePrimitive[] | WhereOperator | WhereOperator[]
export type WhereClause = Record<string, WhereValue>
