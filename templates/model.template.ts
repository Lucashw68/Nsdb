// __IMPORTS__
import type { Tables } from '~~/types/database.types'
import { computed } from 'vue'
import { __PASCAL__Schema } from '~~/nsdb/schemas/__TABLE__'
import { useNsdbSchema } from '@lucashw68/nsdb/useNsdbSchemas'
__STORE_IMPORT__

export type __ROW__ = Tables<'__TABLE__'>

export function __HOOK__(opts: { store?: boolean } = {}) {
	const model = useSupabaseModel<__ROW__>(
		'__TABLE__',
		{ store: !!opts.store, storeCreator: __STORE_CREATOR__ }
	)

	const { 
		fields, 
		editableKeys, 
		emptyFromSchema,
		bindModel,
	} = useNsdbSchema(__PASCAL__Schema);

	const { fetch, find } = bindModel<__ROW__>(model)

	return {
		items: model.items,
		schema: __PASCAL__Schema,
		fields,
		editableKeys,
		new: () => emptyFromSchema(),
		fetch,
		find,
		getById: model.getById,
		create: model.create,
		update: model.update,
		remove: model.remove,
		sync: model.sync,
	}
}
