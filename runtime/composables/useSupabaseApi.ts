import { useSupabaseClient } from '#imports'

/**
 * Direction du tri dans les requêtes.
 */
export type OrderDirection = 'asc' | 'desc'

/**
 * Options pour les requêtes de liste.
 */
export interface ListOptions {
	select?: string
	orderBy?: string
	orderDirection?: OrderDirection
	/**
	 * ✅ NEW: permet un tri sur table jointe.
	 *
	 * IMPORTANT:
	 * - Dans ton cas PostgREST n’applique pas `book.order=title.asc`
	 * - Mais applique bien `order=book(title).asc`
	 *
	 * Donc on transforme:
	 *   orderBy: 'title'
	 *   orderForeignTable: 'book'
	 * en:
	 *   .order('book(title)')
	 */
	orderForeignTable?: string
	limit?: number
	offset?: number
}

/**
 * Opérateur de filtre pour une clause WHERE.
 */
export interface WhereOperator {
	op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'
	value: any
}

/**
 * Valeur possible d'un filtre WHERE.
 */
export type WhereValue = any | WhereOperator | WhereOperator[]

/**
 * Map colonne -> filtre(s).
 */
export type WhereClause = Record<string, WhereValue>

/**
 * Options pour find / findOne.
 */
export interface FindOptions extends ListOptions {
	where?: WhereClause
}

/**
 * Applique les options de tri/pagination à une requête Supabase.
 */
function applyListOptions(
	query: ReturnType<ReturnType<typeof useSupabaseClient>['from']>,
	options: ListOptions
) {
	const {
		orderBy = 'id',
		orderDirection = 'asc',
		orderForeignTable,
		limit = 100,
		offset = 0,
	} = options

	let finalQuery: any = query

	// ✅ Fix: embedded ordering when ordering on a joined/embedded relation.
	// PostgREST (dans ton cas) ignore `book.order=title.asc` mais respecte `order=book(title).asc`.
	// Supabase-js traduit `.order('book(title)')` en `order=book(title).asc`.
	if (orderForeignTable) {
		const embeddedOrderKey = `${orderForeignTable}(${orderBy})`
		finalQuery = finalQuery.order(embeddedOrderKey, {
			ascending: orderDirection === 'asc',
		})
	} else {
		finalQuery = finalQuery.order(orderBy, {
			ascending: orderDirection === 'asc',
		})
	}

	finalQuery = finalQuery.range(offset, offset + limit - 1)

	return finalQuery
}

/**
 * Applique un opérateur de filtre simple sur une colonne donnée.
 */
function applySingleFilter(
	query: any,
	column: string,
	filter: WhereOperator
) {
	switch (filter.op) {
		case 'eq':
			return query.eq(column, filter.value)
		case 'neq':
			return query.neq(column, filter.value)
		case 'gt':
			return query.gt(column, filter.value)
		case 'gte':
			return query.gte(column, filter.value)
		case 'lt':
			return query.lt(column, filter.value)
		case 'lte':
			return query.lte(column, filter.value)
		case 'ilike':
			return query.ilike(column, filter.value)
		case 'in':
			return query.in(column, filter.value)
		default:
			return query.eq(column, filter.value)
	}
}

/**
 * Applique un ensemble de filtres WHERE à une requête Supabase.
 */
function applyWhereFilters(
	query: ReturnType<ReturnType<typeof useSupabaseClient>['from']>,
	where?: WhereClause
) {
	if (!where || Object.keys(where).length === 0) {
		return query
	}

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

/**
 * Unifie la gestion des réponses de Supabase.
 */
function handleResponse<T>(
	data: T | null,
	error: any,
	context: string
) {
	if (error) {
		console.error(`❌ [${context}]`, error)
		return {
			success: false as const,
			error,
			data: undefined as unknown as T,
		}
	}

	return {
		success: true as const,
		error: undefined,
		data,
	}
}

/**
 * Interface Supabase unifiée.
 */
export const useSupabaseApi = () => {
	const supabaseClient = useSupabaseClient?.()

	if (!supabaseClient) {
		throw new Error('[nsdb] Supabase client not found. Install @nuxtjs/supabase.')
	}

	// ############################################################
	// # Basic CRUD
	// ############################################################

	/**
	 * Liste les entrées d'une table.
	 * Supporte 2 formes :
	 *
	 *   all('playlists', '*', 'created_at', 'desc', 20, 0)
	 *   all('playlists', { select: '*', orderBy: 'created_at', orderDirection: 'desc', limit: 20 })
	 *
	 * ✅ Support relation order:
	 *   all('userBooks', { select: '*, book:books(*)', orderBy: 'title', orderForeignTable: 'book' })
	 */
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
				orderBy: selectOrOptions.orderBy ?? orderBy,
				orderDirection: selectOrOptions.orderDirection ?? orderDirection,
				orderForeignTable: selectOrOptions.orderForeignTable,
				limit: selectOrOptions.limit ?? limit,
				offset: selectOrOptions.offset ?? offset,
			}
		}

		const baseQuery = supabaseClient.from(resource).select(selectClause)
		const finalQuery = applyListOptions(baseQuery, options)

		const { data, error } = await finalQuery
		return handleResponse<T[]>(data, error, `ALL ${resource}`)
	}

	/**
	 * Récupère un enregistrement via son identifiant.
	 */
	async function show<T = any>(
		resource: string,
		id: string | number,
		select: string = '*'
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.select(select)
			.eq('id', id)
			.limit(1)
			.single()

		return handleResponse<T>(data, error, `SHOW ${resource}/${id}`)
	}

	/**
	 * Crée un nouvel enregistrement.
	 */
	async function create<T = any>(
		resource: string,
		payload: any
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.insert(payload)
			.select()
			.single()

		return handleResponse<T>(data, error, `CREATE ${resource}`)
	}

	/**
	 * Met à jour un enregistrement.
	 */
	async function update<T = any>(
		resource: string,
		id: string | number,
		payload: any
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.update(payload)
			.eq('id', id)
			.select()

		return handleResponse<T | T[]>(data, error, `UPDATE ${resource}/${id}`)
	}

	/**
	 * Supprime un enregistrement.
	 */
	async function destroy(
		resource: string,
		id: string | number
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.delete()
			.eq('id', id)

		return handleResponse(data, error, `DELETE ${resource}/${id}`)
	}

	/**
	 * Ajoute ou met à jour selon la présence d’un conflit.
	 */
	async function upsert<T = any>(
		resource: string,
		payload: any,
		options: { onConflict?: string } = {}
	) {
		let query = supabaseClient
			.from(resource)
			.upsert(payload)
			.select()

		if (options.onConflict) {
			query = query.onConflict(options.onConflict)
		}

		const { data, error } = await query
		return handleResponse<T | T[]>(data, error, `UPSERT ${resource}`)
	}

	// ############################################################
	// # Advanced CRUD
	// ############################################################

	/**
	 * Liste les entrées correspondant à une propriété donnée.
	 * Supporte également les 2 signatures (ancienne et nouvelle).
	 */
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
				orderBy: selectOrOptions.orderBy ?? orderBy,
				orderDirection: selectOrOptions.orderDirection ?? orderDirection,
				orderForeignTable: selectOrOptions.orderForeignTable,
				limit: selectOrOptions.limit ?? limit,
				offset: selectOrOptions.offset ?? offset,
			}
		}

		const baseQuery = supabaseClient
			.from(resource)
			.select(selectClause)
			.eq(propertyName, propertyValue)

		const finalQuery = applyListOptions(baseQuery, options)
		const { data, error } = await finalQuery

		return handleResponse<T[]>(data, error, `ALL ${resource} WHERE ${propertyName} = ${propertyValue}`)
	}

	/**
	 * Récupère un enregistrement via une propriété donnée.
	 */
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

		return handleResponse<T>(data, error, `SHOW ${resource} WHERE ${propertyName} = ${propertyValue}`)
	}

	/**
	 * Met à jour des enregistrements filtrés par une propriété.
	 */
	async function updateByProperty<T = any>(
		resource: string,
		propertyName: string,
		propertyValue: string | number,
		payload: any
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.update(payload)
			.eq(propertyName, propertyValue)
			.select()

		return handleResponse<T | T[]>(data, error, `UPDATE ${resource} WHERE ${propertyName} = ${propertyValue}`)
	}

	/**
	 * Supprime des enregistrements filtrés par une propriété.
	 */
	async function deleteByProperty(
		resource: string,
		propertyName: string,
		propertyValue: string | number
	) {
		const { data, error } = await supabaseClient
			.from(resource)
			.delete()
			.eq(propertyName, propertyValue)

		return handleResponse(data, error, `DELETE ${resource} WHERE ${propertyName} = ${propertyValue}`)
	}

	/**
	 * Compte tous les enregistrements, ou seulement ceux filtrés.
	 */
	async function count(
		resource: string,
		where?: { property: string; value: string | number }
	) {
		let query = supabaseClient
			.from(resource)
			.select('*', { count: 'exact', head: true })

		if (where) {
			query = query.eq(where.property, where.value)
		}

		const { count, error } = await query
		return handleResponse<number | null>(count ?? null, error, `COUNT ${resource}`)
	}

	// ############################################################
	// # FIND helpers (where + select + order + pagination)
	// ############################################################

	/**
	 * Recherche avancée avec where + tri + pagination.
	 */
	async function find<T = any>(
		resource: string,
		options: FindOptions
	) {
		const {
			select = '*',
			where,
			orderBy,
			orderDirection,
			orderForeignTable,
			limit,
			offset,
		} = options

		const baseQuery = supabaseClient
			.from(resource)
			.select(select)

		const queryWithWhere = applyWhereFilters(baseQuery, where)

		const queryWithOptions = applyListOptions(queryWithWhere, {
			orderBy,
			orderDirection,
			orderForeignTable,
			limit,
			offset,
		})

		const { data, error } = await queryWithOptions
		return handleResponse<T[]>(data, error, `FIND ${resource}`)
	}

	/**
	 * Variante de find qui retourne un seul enregistrement.
	 */
	async function findOne<T = any>(
		resource: string,
		options: FindOptions
	) {
		const {
			select = '*',
			where,
		} = options

		const baseQuery = supabaseClient
			.from(resource)
			.select(select)

		const queryWithWhere = applyWhereFilters(baseQuery, where)
		const { data, error } = await queryWithWhere
			.limit(1)
			.single()

		return handleResponse<T>(data, error, `FIND ONE ${resource}`)
	}

	// ############################################################
	// # Exposed API
	// ############################################################

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
