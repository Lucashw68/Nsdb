// __IMPORTS__
import type { Tables } from '~/types/database.types'
import { computed } from 'vue'
import { __PASCAL__Schema } from '~/nsdb/schemas/__TABLE__'
__STORE_IMPORT__

export type __ROW__ = Tables<'__TABLE__'>

function __emptyFromSchema(): Partial<__ROW__> {
	const out: Record<string, any> = {}
	for (const [k, def] of Object.entries(__PASCAL__Schema as Record<string, any>)) {
		out[k] = 'default' in def ? def.default : (def.type === 'boolean' ? false : null)
	}
	return out as Partial<__ROW__>
}

/** ----- DX handle ----- */
export function __HOOK__(opts: { store?: boolean } = {}) {
	const model = useSupabaseModel<__ROW__>(
		'__TABLE__',
		{ store: !!opts.store, storeCreator: __STORE_CREATOR__ }
	)

	const list = model.items
	const all = async () => {
		const rows = await model.fetch()
		list.value = Array.isArray(rows) ? rows : []
		return list.value as __ROW__[]
	}

	const fields = Object.keys(__PASCAL__Schema)
	const editableKeys = computed(() =>
		Object.entries(__PASCAL__Schema as Record<string, any>)
			.filter(([, d]) => !d.readonly)
			.map(([k]) => k)
	)

	return {
		list,
		schema: __PASCAL__Schema,
		fields,
		editableKeys,
		new: () => __emptyFromSchema(),
		all,
		get: model.getById,
		add: model.create,
		patch: model.update,
		remove: model.remove,
		sync: model.sync,
	}
}
