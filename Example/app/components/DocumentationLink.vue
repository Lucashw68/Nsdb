<script setup lang="ts">
const props = defineProps<{
	path: string
	label?: string
}>()

const config = useRuntimeConfig()
const href = computed(() => `${String(config.public.docsUrl).replace(/\/$/, '')}${props.path}`)
</script>

<template>
	<a class="docs-link" :href="href" target="_blank" rel="noreferrer">
		{{ label ?? 'Read the full documentation' }} →
	</a>
</template>
