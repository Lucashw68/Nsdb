<script setup lang="ts">
const user = useSupabaseUser()
import type { Database } from '~~/types/database.types'

const supabase = useSupabaseClient<Database>()
const subscribedModel = useComponentRecords({ store: true })
const action = useDemoAction()
const externalTitle = ref('')
const listening = ref(false)
const connecting = ref(false)
const busy = computed(() => action.state.value === 'loading')

async function load() {
	if (!user.value) { subscribedModel.invalidate(); return }
	action.loading('Loading the subscribed collection…')
	try {
		await subscribedModel.refresh({ orderBy: 'created_at', orderDirection: 'asc' })
		action.success(`Subscribed client shows ${subscribedModel.items.value.length} rows.`)
	} catch (cause) { action.fail(cause, 'Could not load rows') }
}

async function startListening() {
	connecting.value = true
	action.loading('Connecting the Realtime subscription…')
	try {
		subscribedModel.subscribe()
		// The public subscribe() contract is intentionally void. Keep the external
		// actor disabled while the local WebSocket completes its initial handshake.
		await new Promise(resolve => setTimeout(resolve, 750))
		listening.value = true
		action.success('Listening for database changes.')
	} catch (cause) { action.fail(cause, 'Subscription failed') }
	finally { connecting.value = false }
}

async function stopListening() {
	action.loading('Stopping subscription…')
	try {
		await subscribedModel.unsubscribe()
		listening.value = false
		action.success('Subscription stopped.')
	} catch (cause) { action.fail(cause, 'Could not stop subscription') }
}

async function insertExternally() {
	if (!user.value || !externalTitle.value.trim()) return
	action.loading('External Supabase client is inserting…')
	try {
		const title = externalTitle.value.trim()
		const { error } = await supabase.from('component_records').insert({ title })
		if (error) throw error
		externalTitle.value = ''
		action.success(listening.value ? `Inserted “${title}”. Waiting for Realtime to deliver it to the subscribed model…` : `Inserted “${title}”. Subscribe or refresh to see it.`)
	} catch (cause) { action.fail(cause, 'External insert failed') }
}

watch(() => user.value?.id, async () => {
	listening.value = false
	await load()
	if (user.value) await startListening()
}, { immediate: true })
onBeforeUnmount(() => { void subscribedModel.unsubscribe() })

const snippet = `const records = useComponentRecords({ store: true })
await records.fetch()
records.subscribe()

// A separate actor writes directly through Supabase:
await supabase.from('component_records').insert({ title })`
</script>

<template>
	<DemoShell title="📡 Realtime" description="A subscribed NSDB model reacts when a separate actor writes directly to Supabase. The row arrives through a database event, not through a shared local mutation." docs-path="/docs/core/realtime" docs-label="Read the Realtime guide">
		<IdentityContext />
		<p v-if="!user" class="muted">Choose an identity to subscribe to its RLS-safe events.</p>
		<div class="difference-note"><strong>Shared Store</strong> = the same local Pinia state. <strong>Realtime</strong> = a database change from another source.</div>
		<div class="actor-grid">
			<section class="actor subscribed" aria-labelledby="subscriber-title">
				<p class="actor-label">ACTOR 1</p><h2 id="subscriber-title">Subscribed NSDB client</h2>
				<p class="subscription-state" :data-listening="listening"><span />{{ connecting ? 'Connecting…' : listening ? 'Listening' : 'Not subscribed' }}</p>
				<div class="controls"><button :disabled="!user || busy" @click="listening ? stopListening() : startListening()">{{ listening ? 'Stop listening' : 'Start listening' }}</button><button :disabled="!user || busy" @click="load">Refresh once</button></div>
				<ul id="realtime-rows" class="result-list"><li v-for="row in subscribedModel.items.value" :key="row.id" class="result-row"><span>{{ row.title }}</span></li></ul>
				<p v-if="user && !busy && !subscribedModel.items.value.length" class="muted">No rows are visible yet.</p>
			</section>
			<section class="actor external" aria-labelledby="external-title">
				<p class="actor-label">ACTOR 2</p><h2 id="external-title">External Supabase client</h2>
				<p class="muted">This form bypasses the NSDB model and inserts with the authenticated Supabase client.</p>
				<form @submit.prevent="insertExternally"><label class="field"><span>Row title</span><input v-model="externalTitle" placeholder="Remote database event" :disabled="!user || busy || !listening" /></label><button id="realtime-external-insert" class="primary-action" :disabled="!user || busy || !listening || !externalTitle.trim()">{{ busy && action.label.value.includes('inserting') ? 'Inserting…' : 'Insert directly' }}</button></form>
			</section>
		</div>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<template #code><CodeSnippet title="Subscription plus external write" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.difference-note { margin: 1rem 0; padding: .8rem 1rem; border-left: 3px solid #38bdf8; background: rgba(14, 116, 144, .12); color: #bae6fd; line-height: 1.5; }
.actor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.actor { min-width: 0; padding: 1.15rem; border: 1px solid var(--border); border-radius: .7rem; background: #0b1220; }
.actor h2 { margin: 0; font-size: 1.15rem; }
.actor-label { margin: 0 0 .35rem; color: var(--accent); font-size: .72rem; letter-spacing: .12em; }
.subscription-state { display: flex; gap: .5rem; align-items: center; color: #fbbf24; }
.subscription-state span { width: .6rem; height: .6rem; border-radius: 50%; background: currentColor; }
.subscription-state[data-listening='true'] { color: #34d399; }
.external form { display: grid; gap: .8rem; margin-top: 1rem; }
.primary-action { background: #0369a1; border-color: #38bdf8; }
@media (max-width: 760px) { .actor-grid { grid-template-columns: 1fr; } }
</style>
