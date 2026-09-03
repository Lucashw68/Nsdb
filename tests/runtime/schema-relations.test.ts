import { describe, expect, it, vi } from 'vitest'
import { useNsdbSchema } from '../../runtime/composables/useNsdbSchemas'
import type { EntityRelation } from '../../types/entities'

const schema = {
	id: { label: 'id', type: 'text' as const, selectable: true },
	parent_id: {
		label: 'parent_id',
		type: 'relation' as const,
		selectable: true,
		relation: {
			alias: 'parent',
			kind: 'belongsTo' as const,
			direction: 'forward' as const,
			nullable: true,
			referencedTable: 'categories',
			embedResource: 'parent_id',
			localColumns: ['parent_id'],
			referencedColumns: ['id'],
			foreignKeyName: 'categories_parent_id_fkey',
		},
	},
}

const relations: EntityRelation[] = [
	schema.parent_id.relation,
	{
		alias: 'children', kind: 'hasMany', direction: 'inverse', nullable: false,
		referencedTable: 'categories', embedResource: 'categories',
		localColumns: ['id'], referencedColumns: ['parent_id'],
		foreignKeyName: 'categories_parent_id_fkey',
	},
	{
		alias: 'tags', kind: 'manyToMany', direction: 'through', nullable: false,
		referencedTable: 'tags', embedResource: 'tags', throughTable: 'post_tags',
		localColumns: ['id'], referencedColumns: ['id'],
	},
]

describe('relation selects', () => {
	it('uses unambiguous PostgREST resources for self, inverse and many-to-many includes', async () => {
		const fetch = vi.fn(async () => [])
		const bound = useNsdbSchema(schema, relations).bindModel<{ id: string }, {
			parent: { id: string } | null
			children: Array<{ id: string }>
			tags: Array<{ id: string }>
		}>({ fetch })

		await bound.fetch({ include: ['parent', 'children', 'tags'] })
		expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
			select: 'id, parent_id, parent:parent_id(*), children:categories!categories_parent_id_fkey(*), tags:tags(*)',
		}))
	})

	it('uses the same self-reference resource in the backwards-compatible automatic select', () => {
		const { buildSelectFromSchema } = useNsdbSchema(schema, relations)
		expect(buildSelectFromSchema()).toBe('id, parent_id, parent:parent_id(*)')
	})

	it('rejects unknown aliases instead of emitting an ambiguous query', () => {
		const { buildSelectFromSchema } = useNsdbSchema(schema, relations)
		expect(() => buildSelectFromSchema(schema, undefined, ['writer'])).toThrow(/Unknown relation include/)
	})
})
