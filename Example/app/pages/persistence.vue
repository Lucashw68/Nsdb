<template>
	<main data-persistence-fixture :data-ready="ready">
		<p id="persistence-auth">{{ identityId ? `authenticated:${identityId}` : 'anonymous' }}</p>
		<p id="persistence-ready">{{ store.hydrationReady ? 'ready' : 'validating' }}</p>
		<ul id="persisted-rows">
			<li v-for="row in store.items" :key="row.id">{{ row.title }}</li>
		</ul>
		<input v-model="email" aria-label="Persistence email" />
		<input v-model="password" aria-label="Persistence password" type="password" />
		<button id="persistence-signup" @click="signup">Sign up</button>
		<button id="persistence-login" @click="login">Login</button>
		<button id="persistence-logout" @click="logout">Logout</button>
		<p id="persistence-error">{{ error }}</p>
	</main>
</template>

<script setup lang="ts">
type PersistedRow = { id: string; title: string }

const route = useRoute()
const supabase = useSupabaseClient()
const usePersistedFixtureStore = createDbStore<PersistedRow>('persisted_playlists', {
	persist: true,
	scopeToUser: true,
})
const store = usePersistedFixtureStore()
const email = ref('')
const password = ref('')
const error = ref('')
const identityId = ref<string | null>(null)
const ready = ref(false)

async function run(operation: () => Promise<void>) {
	error.value = ''
	try {
		await operation()
	} catch (cause: any) {
		error.value = cause?.message ?? String(cause)
	}
}

async function signup() {
	await run(async () => {
		const { data, error: authError } = await supabase.auth.signUp({ email: email.value, password: password.value })
		if (authError) throw authError
		identityId.value = data.user?.id ?? null
	})
}

async function login() {
	await run(async () => {
		const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
		if (authError) throw authError
		identityId.value = data.user.id
	})
}

async function logout() {
	await run(async () => {
		const { error: authError } = await supabase.auth.signOut()
		if (authError) throw authError
		identityId.value = null
	})
}

onMounted(async () => {
	const { data } = await supabase.auth.getSession()
	identityId.value = data.session?.user.id ?? null
	ready.value = true
	const delayedEmail = typeof route.query.loginEmail === 'string' ? route.query.loginEmail : ''
	const delayedPassword = typeof route.query.loginPassword === 'string' ? route.query.loginPassword : ''
	if (!delayedEmail || !delayedPassword) return

	setTimeout(() => {
		email.value = delayedEmail
		password.value = delayedPassword
		void login()
	}, 250)
})
</script>
