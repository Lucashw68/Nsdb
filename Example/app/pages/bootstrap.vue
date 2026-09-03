<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
		</span>

		<h1 class="text-4xl font-bold mb-4 mt-4">🚀 Get started</h1>

		<ContentRenderer v-if="getStartedDoc" :value="getStartedDoc" class="prose prose-slate max-w-none nsdb-doc" />

    </div>
</template>

<script setup>
const { data: getStartedDoc } = await useAsyncData('get-started-doc', () => queryCollection('module').path('/module/readme').first())
</script>