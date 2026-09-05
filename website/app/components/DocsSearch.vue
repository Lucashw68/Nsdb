<script setup lang="ts">
const open = useState('docs-search-open', () => false)
const query = ref('')
const input = ref<HTMLInputElement | null>(null)

const { data: sections } = await useAsyncData('docs-search-sections', () => queryCollectionSearchSections('docs'))

const results = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return []
  return (sections.value ?? [])
    .filter(section => `${section.title} ${section.content}`.toLowerCase().includes(term))
    .slice(0, 10)
})

function close() {
  open.value = false
  query.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
watch(open, value => value && nextTick(() => input.value?.focus()))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="search-overlay" role="presentation" @click.self="close">
      <section class="search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation">
        <div class="search-input-wrap">
          <Icon name="i-lucide-search" aria-hidden="true" />
          <input ref="input" v-model="query" type="search" placeholder="Search the documentation…" aria-label="Search query">
          <UKbd>Esc</UKbd>
        </div>
        <div class="search-results" aria-live="polite">
          <p v-if="!query" class="search-hint">Search concepts, methods, components, or configuration.</p>
          <p v-else-if="!results.length" class="search-hint">No matching documentation found.</p>
          <NuxtLink
            v-for="result in results"
            :key="`${result.id}-${result.title}`"
            :to="result.id"
            class="search-result"
            @click="close"
          >
            <strong>{{ result.title }}</strong>
            <span>{{ result.content.slice(0, 140) }}</span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </Teleport>
</template>
