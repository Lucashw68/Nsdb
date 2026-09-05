// __IMPORTS__
import type { Tables, TablesInsert, TablesUpdate } from '~~/types/database.types'
import { __PASCAL__Relations, __PASCAL__Schema } from '~~/nsdb/schemas/__TABLE__'
import { useNsdbSchema } from '@lucashw68/nsdb/useNsdbSchema'
__STORE_IMPORT__

export type __ROW__ = Omit<Tables<'__TABLE__'>, __ROW_OMIT__>
export type __PASCAL__Insert = Omit<TablesInsert<'__TABLE__'>, __INSERT_OMIT__>
export type __PASCAL__Update = Omit<TablesUpdate<'__TABLE__'>, __UPDATE_OMIT__>
export type __PASCAL__RelationRows = __RELATION_ROWS__

export function __HOOK__(opts: { store?: boolean } = {}) {
	const model = useSupabaseModel<__ROW__, __PASCAL__Insert, __PASCAL__Update, '__PRIMARY_KEY__'>(
		'__TABLE__',
		{ store: !!opts.store, storeCreator: __STORE_CREATOR__, primaryKey: '__PRIMARY_KEY__' }
	)

	const {
		fields,
		editableKeys,
		createDraftFromSchema,
		bindModel,
	} = useNsdbSchema(__PASCAL__Schema, __PASCAL__Relations);

	const { fetch, refresh } = bindModel<__ROW__, __PASCAL__RelationRows>(model)

	return {
		primaryKey: '__PRIMARY_KEY__' as const,
		items: model.items,
		totalCount: model.totalCount,
		loading: model.loading,
		error: model.error,
		stale: model.stale,
		schema: __PASCAL__Schema,
		fields,
		editableKeys,
		createDraft: () => createDraftFromSchema(),
		fetch,
		refresh,
		invalidate: model.invalidate,
		getById: model.getById,
		create: model.create,
		update: model.update,
		remove: model.remove,
		subscribe: model.subscribe,
		unsubscribe: model.unsubscribe,
	}
}
