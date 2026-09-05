<script setup lang="ts">
const posts = usePosts()
const rows = ref<Awaited<ReturnType<typeof posts.fetch>>>([])
const action = useDemoAction()

async function load() {
	action.loading('Resolving the author relation…')
	try {
		rows.value = await posts.fetch({ include: ['author'], orderBy: 'title' })
		action.success(`Resolved ${rows.value.length} post${rows.value.length === 1 ? '' : 's'} with author data.`)
	} catch (cause) { action.fail(cause, 'Relation query failed') }
}

onMounted(() => { void load() })

const snippet = `const posts = usePosts()

await posts.fetch({
  include: ['author'],
})

posts.items.value[0].author.name`
</script>

<template>
	<DemoShell title="🔗 Relations" description="See a raw foreign key become a readable related row. NSDB uses generated relation metadata so common includes do not require PostgREST syntax." docs-path="/docs/supabase/relations" docs-label="Read the relations guide">
		<div class="relation-flow" aria-label="Foreign key resolved to included author">
			<article v-for="post in rows" :key="post.id" class="entity-card">
				<p class="entity-label">POST</p>
				<dl><dt>title</dt><dd>{{ post.title }}</dd><dt>author_id <span>foreign key</span></dt><dd class="raw-key">{{ post.author_id }}</dd></dl>
				<div class="relation-arrow" aria-hidden="true">include: ['author'] →</div>
				<section class="resolved-card"><p class="entity-label">RESOLVED AUTHOR</p><dl><dt>author.name</dt><dd class="related-value">{{ post.author.name }}</dd><dt>author.id</dt><dd class="raw-key">{{ post.author.id }}</dd></dl></section>
			</article>
		</div>
		<p v-if="action.state.value === 'success' && !rows.length" class="muted">No seeded posts found.</p>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<template #code><CodeSnippet title="The real generated include" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.relation-flow { display: grid; gap: 1rem; }
.entity-card { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(220px, .8fr); gap: 1rem; align-items: center; padding: 1.2rem; border: 1px solid var(--border); border-radius: .7rem; background: #0b1220; }
.entity-label { grid-column: 1 / -1; margin: 0; color: var(--accent); font-size: .72rem; font-weight: 700; letter-spacing: .12em; }
dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .5rem .8rem; margin: 0; }
dt { color: var(--muted); font-size: .8rem; } dt span { color: #fbbf24; }
dd { margin: 0; overflow-wrap: anywhere; }
.raw-key { color: #9ca3af; font-size: .75rem; }
.relation-arrow { color: #c084fc; font-weight: 700; white-space: nowrap; }
.resolved-card { padding: 1rem; border: 1px solid #047857; border-radius: .6rem; background: rgba(6, 95, 70, .14); }
.related-value { color: #6ee7b7; font-size: 1.15rem; font-weight: 700; }
@media (max-width: 760px) { .entity-card { grid-template-columns: 1fr; } .relation-arrow { transform: rotate(90deg); justify-self: center; } }
</style>
