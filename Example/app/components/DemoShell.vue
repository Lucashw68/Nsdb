<script setup lang="ts">
defineProps<{
	title: string
	description: string
	docsPath: string
	docsLabel?: string
}>()
</script>

<template>
	<main class="demo-page">
		<NuxtLink class="back-link" to="/">← All demos</NuxtLink>
		<header class="demo-intro">
			<h1>{{ title }}</h1>
			<p>{{ description }}</p>
		</header>

		<section class="demo-panel">
			<slot />
		</section>

		<section class="how-it-works">
			<h2>How it works</h2>
			<slot name="code" />
			<DocumentationLink :path="docsPath" :label="docsLabel" />
		</section>
	</main>
</template>
