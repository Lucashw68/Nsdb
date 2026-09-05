<script setup lang="ts">
import type { DemoActionState, DemoErrorDetails } from '~/composables/useDemoAction'

defineProps<{
	state: DemoActionState
	message?: string
	error?: DemoErrorDetails | null
}>()
</script>

<template>
	<div v-if="state !== 'idle'" class="demo-status" :data-state="state" :role="state === 'error' ? 'alert' : 'status'" aria-live="polite">
		<span class="status-mark" aria-hidden="true">{{ state === 'loading' ? '◌' : state === 'success' ? '✓' : '!' }}</span>
		<div>
			<strong>{{ message }}</strong>
			<p v-if="error">{{ error.message }}</p>
			<dl v-if="error && (error.code || error.details || error.hint)" class="error-details">
				<template v-if="error.code"><dt>Code</dt><dd>{{ error.code }}</dd></template>
				<template v-if="error.details"><dt>Details</dt><dd>{{ error.details }}</dd></template>
				<template v-if="error.hint"><dt>Hint</dt><dd>{{ error.hint }}</dd></template>
			</dl>
		</div>
	</div>
</template>

<style scoped>
.demo-status { display: flex; gap: .75rem; align-items: flex-start; margin: 1rem 0 0; padding: .8rem 1rem; border: 1px solid #374151; border-radius: .6rem; background: rgba(55, 65, 81, .18); }
.demo-status[data-state='loading'] { border-color: #1d4ed8; color: #bfdbfe; }
.demo-status[data-state='success'] { border-color: #047857; color: #a7f3d0; }
.demo-status[data-state='error'] { border-color: #b91c1c; color: #fecaca; }
.status-mark { display: grid; place-items: center; flex: 0 0 1.4rem; height: 1.4rem; border: 1px solid currentColor; border-radius: 999px; font-weight: 700; }
p { margin: .3rem 0 0; }
.error-details { display: grid; grid-template-columns: auto 1fr; gap: .2rem .7rem; margin: .55rem 0 0; font-size: .78rem; }
dt { color: #fca5a5; font-weight: 700; }
dd { margin: 0; overflow-wrap: anywhere; }
</style>
