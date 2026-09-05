<script setup lang="ts">
const config = useRuntimeConfig()
const { user, busy, error, useLocalAccount, logout } = usePlaygroundAuth()

const isLocal = computed(() => config.public.playgroundEnvironment === 'local')
const hydrated = ref(false)

onMounted(() => {
	hydrated.value = true
})

</script>

<template>
	<header class="playground-header" :data-playground-ready="hydrated">
		<NuxtLink class="brand" to="/">💾 NSDB Playground</NuxtLink>
		<IdentityContext />
		<nav aria-label="Playground utilities">
			<span class="environment" :class="{ local: isLocal }">
				{{ isLocal ? 'Local Supabase' : 'Custom Supabase' }}
			</span>
			<template v-if="isLocal">
				<button :disabled="busy || !hydrated" type="button" @click="useLocalAccount('alice')">Use Alice</button>
				<button :disabled="busy || !hydrated" type="button" @click="useLocalAccount('bob')">Use Bob</button>
			</template>
			<button v-if="user" :disabled="busy || !hydrated" type="button" @click="logout">Sign out</button>
			<a :href="String(config.public.docsUrl)" target="_blank" rel="noreferrer">Documentation ↗</a>
		</nav>
		<p class="auth-state" aria-live="polite">{{ user ? `Authenticated as ${user.email}` : 'Not signed in' }}</p>
		<p v-if="error" class="header-error" role="alert">{{ error }}</p>
	</header>
</template>
