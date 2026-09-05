<script setup lang="ts">
const config = useRuntimeConfig()
const { user, busy: authBusy, error: authError, useLocalAccount } = usePlaygroundAuth()
const playlists = usePlaylists({ store: true })
const action = useDemoAction()
const title = ref('')
const busy = computed(() => authBusy.value || action.state.value === 'loading')
const identityName = computed(() => user.value?.email?.startsWith('alice+') ? 'Alice' : user.value?.email?.startsWith('bob+') ? 'Bob' : user.value ? 'Signed-in user' : 'Anonymous')

async function refresh() {
	if (!user.value) { playlists.invalidate(); return }
	action.loading(`Loading rows authorized for ${identityName.value}…`)
	try {
		await playlists.refresh({ orderBy: 'created_at', orderDirection: 'asc' })
		action.success(`RLS returned ${playlists.items.value.length} row${playlists.items.value.length === 1 ? '' : 's'} for ${identityName.value}.`)
	} catch (cause) { action.fail(cause, 'Authorized read failed') }
}

async function switchIdentity(name: 'alice' | 'bob') {
	action.loading(`Signing in as ${name === 'alice' ? 'Alice' : 'Bob'}…`)
	await useLocalAccount(name)
	if (authError.value) { action.fail(new Error(authError.value), 'Sign-in failed'); return }
	await refresh()
}

async function create() {
	if (!title.value.trim()) return
	action.loading(`Creating a private row for ${identityName.value}…`)
	try {
		const row = await playlists.create({ title: title.value.trim() })
		title.value = ''
		action.success(`Created “${row.title}”. Only ${identityName.value} can read it.`)
	} catch (cause) { action.fail(cause, 'Private create failed') }
}

watch(() => user.value?.id, () => { void refresh() }, { immediate: true })

const modelSnippet = `const playlists = usePlaylists({ store: true })

await playlists.fetch()
await playlists.create({ title: 'My private playlist' })`
const policySnippet = `create policy "playlists_select_own"
on public.playlists for select
to authenticated
using (auth.uid() = user_id);`
</script>

<template>
	<DemoShell title="🔐 Auth & RLS" description="Switch between the real seeded Alice and Bob accounts. Supabase RLS—not a frontend filter—changes which playlists the shared NSDB model can read." docs-path="/docs/supabase/rls" docs-label="Read the RLS guide">
		<section class="identity-stage" aria-labelledby="active-identity-title">
			<p class="stage-label">CURRENT IDENTITY</p><h2 id="active-identity-title">{{ user ? identityName : 'Not signed in' }}</h2><p>{{ user?.email ?? 'Choose a local account to begin.' }}</p>
			<div v-if="config.public.playgroundEnvironment === 'local'" class="identity-switch"><button id="rls-alice" :class="{ active: identityName === 'Alice' }" :disabled="busy" @click="switchIdentity('alice')">1. Sign in as Alice</button><button id="rls-bob" :class="{ active: identityName === 'Bob' }" :disabled="busy" @click="switchIdentity('bob')">2. Switch to Bob</button></div>
		</section>
		<div class="responsibility-note"><span><strong>Supabase Auth</strong> establishes identity.</span><span><strong>RLS</strong> decides which rows are accessible.</span><span><strong>NSDB</strong> isolates shared client state by that identity.</span></div>
		<section class="authorized-data" aria-labelledby="authorized-title">
			<div><p class="stage-label">VISIBLE RESULT</p><h2 id="authorized-title">Rows Supabase allows {{ identityName }} to read</h2></div>
			<form class="controls" @submit.prevent="create"><label class="field"><span>Private playlist title</span><input v-model="title" placeholder="Only this identity can see it" :disabled="!user || busy" /></label><button :disabled="!user || busy || !title.trim()">{{ action.state.value === 'loading' && action.label.value.includes('Creating') ? 'Creating…' : 'Create private row' }}</button><button type="button" :disabled="!user || busy" @click="refresh">Refresh authorized rows</button></form>
			<ul id="ownership-rows" class="result-list"><li v-for="row in playlists.items.value" :key="row.id" class="result-row"><span>{{ row.title }}</span><small>visible to {{ identityName }}</small></li></ul>
			<p v-if="user && action.state.value !== 'loading' && !playlists.items.value.length" class="muted">RLS returned no rows for this identity.</p>
		</section>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<template #code><div class="demo-grid"><CodeSnippet title="Generated model" :code="modelSnippet" /><CodeSnippet title="Real Supabase policy" :code="policySnippet" /></div></template>
	</DemoShell>
</template>

<style scoped>
.identity-stage { padding: 1.2rem; border: 1px solid #047857; border-radius: .7rem; background: rgba(6, 95, 70, .14); }
.identity-stage h2, .identity-stage p { margin: .2rem 0; }
.stage-label { color: var(--accent); font-size: .72rem; font-weight: 700; letter-spacing: .12em; }
.identity-switch { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
.identity-switch .active { border-color: #34d399; color: #6ee7b7; }
.responsibility-note { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin: 1rem 0; }
.responsibility-note span { padding: .7rem; border: 1px solid var(--border); border-radius: .55rem; color: var(--muted); font-size: .82rem; line-height: 1.4; }
.responsibility-note strong { color: white; }
.authorized-data { margin-top: 1.2rem; }
.authorized-data h2 { margin: .2rem 0; font-size: 1.15rem; }
.result-row small { color: #6ee7b7; }
@media (max-width: 760px) { .responsibility-note { grid-template-columns: 1fr; } }
</style>
