<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>()
</script>

<template>
  <div class="site-shell">
    <SiteHeader />
    <main class="error-page">
      <div>
        <h1>{{ props.error.statusCode ?? 404 }}</h1>
        <h2>That bridge does not lead anywhere.</h2>
        <p>{{ props.error.statusMessage ?? 'The page could not be found.' }}</p>
        <UButton to="/docs/getting-started/introduction" icon="i-lucide-book-open">Back to documentation</UButton>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
