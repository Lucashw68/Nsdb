<template>
  <main>
    <NsdbList model="playlists" />
    <NsdbForm model="playlists" />
    <p>{{ playlists.items.value.length }}</p>
  </main>
</template>

<script setup lang="ts">
import type { ModelQuery } from '@lucashw68/nsdb/types'

const playlists = usePlaylists()
const features = useSchemaFeatures()
const posts = usePosts()
const authors = useAuthors()
const messages = useMessages()
const categories = useCategories()

async function exercisePublicApi(id: string) {
  await playlists.fetch()
	await playlists.refresh()
	playlists.invalidate()
	await playlists.create({ title: 'External package' })
  await playlists.update(id, { title: 'Updated package' })
	await playlists.remove(id)
	playlists.createDraft()
	playlists.subscribe()
	await playlists.unsubscribe()
}

void exercisePublicApi

const canonicalQuery = {
	where: { title: { op: 'ilike', value: '%rock%' } },
	search: 'rock',
	searchColumns: ['title'],
	orderBy: 'title',
	orderDirection: 'asc',
	limit: 20,
	offset: 0,
} as const satisfies ModelQuery<never, 'id' | 'title'>
void playlists.fetch(canonicalQuery)

// @ts-expect-error generated row columns protect obvious ordering mistakes
void playlists.fetch({ orderBy: 'unknown_column' })
// @ts-expect-error generated row columns protect obvious search-column mistakes
void playlists.fetch({ search: 'x', searchColumns: ['unknown_column'] })
// @ts-expect-error refresh replaces the removed force query flag
void playlists.fetch({ force: true })

async function exerciseIntrospectedTypes() {
  await features.create({ slug: 'custom-key', required_field: 'required' })
  await features.update('custom-key', { custom_default: 'changed', nullable_field: null })
  // @ts-expect-error identity columns are not insertable
  await features.create({ slug: 'bad', required_field: 'required', sequence_id: 1 })
  // @ts-expect-error generated columns are not updatable
  await features.update('custom-key', { computed_label: 'forbidden' })
  // @ts-expect-error the custom primary key is not updatable
  await features.update('custom-key', { slug: 'new-key' })
}

void exerciseIntrospectedTypes

async function exerciseRelationTypes() {
	const rows = await posts.fetch({ include: ['author', 'tags'] })
	rows[0]?.author.name.toUpperCase()
	rows[0]?.tags[0]?.name.toUpperCase()
	const refreshed = await posts.refresh({ include: ['author'] })
	refreshed[0]?.author.name.toUpperCase()
	const authorRows = await authors.fetch({ include: ['posts', 'sender_messages', 'receiver_messages'] })
	authorRows[0]?.posts[0]?.title.toUpperCase()
	authorRows[0]?.sender_messages[0]?.body.toUpperCase()
	const messageRows = await messages.fetch({ include: ['sender', 'receiver'] })
	messageRows[0]?.sender.name.toUpperCase()
	messageRows[0]?.receiver.name.toUpperCase()
	const categoryRows = await categories.fetch({ include: ['parent', 'children'] })
	categoryRows[0]?.parent?.name.toUpperCase()
	categoryRows[0]?.children[0]?.name.toUpperCase()
  // @ts-expect-error unknown relation aliases are rejected
  await posts.fetch({ include: ['writer'] })
}

void exerciseRelationTypes
</script>
