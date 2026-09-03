import { useSupabaseClient } from '#imports'
import type {
	ListOptions,
} from '@lucashw68/nsdb/types/list'
import { applyListOptions, applySearch, applyWhereFilters } from '../query'

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

/** Canonical low-level response-object API. */

export const useSupabaseApi = () => {
	const supabaseClient = useSupabaseClient?.()
	if (!supabaseClient) {
		throw new Error('[nsdb] Supabase client not found. Install @nuxtjs/supabase.')
	}
	// This advanced API deliberately accepts runtime table names. Recent typed
	// Supabase clients narrow `from()` to generated relations, so keep the
	// unavoidable dynamic cast at this single low-level escape-hatch boundary.
	const from = (resource: string): QueryBuilder => (
		supabaseClient.from as unknown as (relation: string) => QueryBuilder
	)(resource)

	async function all<T = any>(
		resource: string,
		options: ListOptions = {},
	): Promise<SupabaseApiListResponse<T>> {
		const selectClause = options.select ?? '*'

		let q: QueryBuilder = from(resource).select(selectClause, { count: 'exact' })
		q = applyWhereFilters(q, options.where)
		q = applySearch(q, options)
		q = applyListOptions(q, options)

		const { data, error, count } = await q
		return handleListResponse<T>(data, count ?? null, error, `ALL ${resource}`)
	}

	async function getById<T = any>(
		resource: string,
		id: string | number,
		options: { key?: string; select?: string } = {},
	) {
		const { data, error } = await from(resource)
			.select(options.select ?? '*')
			.eq(options.key ?? 'id', id)
			.limit(1)
			.single()

		return handleResponse<T>({ data, error }, `GET ${resource}/${id}`)
	}

	async function create<T = any>(resource: string, payload: MutationPayload) {
		const { data, error } = await from(resource).insert(payload).select().single()
		return handleResponse<T>({ data, error }, `CREATE ${resource}`)
	}

	async function update<T = any>(
		resource: string,
		id: string | number,
		payload: MutationPayload,
		options: { key?: string } = {},
	) {
		const { data, error } = await from(resource).update(payload).eq(options.key ?? 'id', id).select()
		return handleResponse<T | T[]>({ data, error }, `UPDATE ${resource}/${id}`)
	}

	async function remove(resource: string, id: string | number, options: { key?: string } = {}) {
		const { data, error } = await from(resource).delete().eq(options.key ?? 'id', id)
		return handleResponse({ data, error }, `DELETE ${resource}/${id}`)
	}

	async function upsert<T = any>(resource: string, payload: MutationPayload, options: { onConflict?: string } = {}) {
		const upsertOptions = options.onConflict ? { onConflict: options.onConflict } : undefined
		const q: QueryBuilder = from(resource)
			.upsert(payload, upsertOptions)
			.select()
		const { data, error } = await q
		return handleResponse<T | T[]>({ data, error }, `UPSERT ${resource}`)
	}

	async function count(resource: string, where?: { property: string; value: string | number }) {
		let q: QueryBuilder = from(resource).select('*', { count: 'exact', head: true })
		if (where) q = q.eq(where.property, where.value)
		const { count, error } = await q
		return handleResponse<number | null>({ data: count ?? null, error }, `COUNT ${resource}`)
	}

	async function findOne<T = any>(resource: string, options: ListOptions) {
		const { select = '*', where } = options
		let q: QueryBuilder = from(resource).select(select)
		q = applyWhereFilters(q, where)
		const { data, error } = await q.limit(1).single()
		return handleResponse<T>({ data, error }, `FIND ONE ${resource}`)
	}

	return {
		all,
		getById,
		create,
		update,
		remove,
		upsert,
		count,
		findOne,
	}
}
