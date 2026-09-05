<script setup lang="ts">
const open = useState('docs-search-open', () => false)
</script>

<template>
  <UButton
    class="search-trigger"
    color="neutral"
    variant="soft"
    icon="i-lucide-search"
    aria-label="Search documentation"
    @click="open = true"
  >
    <span class="search-trigger-label">Search</span>
    <UKbd>⌘ K</UKbd>
  </UButton>
</template>
