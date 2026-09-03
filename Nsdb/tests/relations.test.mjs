import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRelationCatalog } from '../helpers/relations.js'

const column = (nullable = false, hasDefault = false) => ({ nullable, hasDefault, generated: false })
const fk = (foreignKeyName, columns, referencedRelation, referencedColumns = ['id']) => ({
	foreignKeyName,
	columns,
	referencedRelation,
	referencedColumns,
	isOneToOne: false,
})
const table = (columns, relationships = [], primaryKey = ['id'], uniqueConstraints = []) => ({
	columns,
	relationships,
	primaryKey,
	uniqueConstraints,
})

const metadata = {
	tables: {
		authors: table({ id: column() }),
		posts: table(
			{ id: column(), author_id: column() },
			[fk('posts_author_id_fkey', ['author_id'], 'authors')],
		),
		messages: table(
			{ id: column(), sender_id: column(), receiver_id: column() },
			[
				fk('messages_sender_id_fkey', ['sender_id'], 'authors'),
				fk('messages_receiver_id_fkey', ['receiver_id'], 'authors'),
			],
		),
		categories: table(
			{ id: column(), parent_id: column(true) },
			[fk('categories_parent_id_fkey', ['parent_id'], 'categories')],
		),
		tags: table({ id: column() }),
		post_tags: table(
			{ post_id: column(), tag_id: column() },
			[
				fk('post_tags_post_id_fkey', ['post_id'], 'posts'),
				fk('post_tags_tag_id_fkey', ['tag_id'], 'tags'),
			],
			['post_id', 'tag_id'],
		),
		composite_parents: table({ tenant_id: column(), code: column() }, [], ['tenant_id', 'code']),
		composite_children: table(
			{ id: column(), tenant_id: column(), parent_code: column() },
			[fk(
				'composite_children_tenant_id_parent_code_fkey',
				['tenant_id', 'parent_code'],
				'composite_parents',
				['tenant_id', 'code'],
			)],
		),
	},
}

test('relation catalog keeps every relation topology unambiguous', () => {
	const exposed = new Set(Object.keys(metadata.tables))
	const catalog = buildRelationCatalog(metadata, exposed)

	assert.deepEqual(catalog.messages.map(item => item.alias), ['sender', 'receiver'])
	assert.ok(catalog.authors.some(item => item.alias === 'posts' && item.direction === 'inverse'))
	assert.ok(catalog.authors.some(item => item.alias === 'sender_messages'))
	assert.ok(catalog.authors.some(item => item.alias === 'receiver_messages'))
	assert.deepEqual(
		catalog.categories.map(item => [item.alias, item.embedResource, item.nullable]),
		[['parent', 'parent_id', true], ['children', 'categories', false]],
	)
	assert.ok(catalog.posts.some(item => item.alias === 'tags' && item.kind === 'manyToMany'))
	assert.ok(catalog.tags.some(item => item.alias === 'posts' && item.kind === 'manyToMany'))
	assert.ok(catalog.composite_children.some(item => item.composite === true))
})

test('join detection stays explicit and does not hide tables with payload columns', () => {
	metadata.tables.post_tags.columns.position = column(false, false)
	const catalog = buildRelationCatalog(metadata, new Set(Object.keys(metadata.tables)))
	assert.equal(catalog.posts.some(item => item.kind === 'manyToMany'), false)
	delete metadata.tables.post_tags.columns.position
})
