<script setup lang="ts">
const user = useSupabaseUser()
const identity = computed(() => {
	const email = user.value?.email ?? ''
	if (email.startsWith('alice+')) return 'Alice'
	if (email.startsWith('bob+')) return 'Bob'
	return user.value ? 'Signed-in user' : 'Anonymous'
})
</script>

<template>
	<div class="identity-context" :data-authenticated="Boolean(user)">
		<span class="identity-dot" aria-hidden="true" />
		<div>
			<span>{{ user ? 'Signed in as' : 'Current identity' }}</span>
			<strong>{{ user ? identity : 'Not signed in' }}</strong>
			<small v-if="user">{{ user.email }}</small>
			<small v-else>Protected data is unavailable.</small>
		</div>
	</div>
</template>

<style scoped>
.identity-context { display: flex; gap: .7rem; align-items: center; min-width: 235px; padding: .65rem .8rem; border: 1px solid #92400e; border-radius: .65rem; background: rgba(120, 53, 15, .16); }
.identity-context[data-authenticated='true'] { border-color: #047857; background: rgba(6, 95, 70, .18); }
.identity-dot { width: .65rem; height: .65rem; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 4px rgba(245, 158, 11, .12); }
[data-authenticated='true'] .identity-dot { background: #34d399; box-shadow: 0 0 0 4px rgba(52, 211, 153, .12); }
.identity-context div { display: grid; line-height: 1.2; }
.identity-context span, .identity-context small { color: var(--muted); font-size: .7rem; }
.identity-context strong { margin: .14rem 0; color: white; font-size: .95rem; text-transform: uppercase; }
</style>
