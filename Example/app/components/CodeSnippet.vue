<script setup lang="ts">
defineProps<{
	title?: string
	code: string
}>()
</script>

<template>
	<section class="code-card">
		<h2 v-if="title">{{ title }}</h2>
		<pre><code>{{ code }}</code></pre>
	</section>
</template>

