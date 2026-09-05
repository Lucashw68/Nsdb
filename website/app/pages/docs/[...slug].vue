<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const route = useRoute()
const path = computed(() => route.path.replace(/\/$/, '') || '/')

const { data: page } = await useAsyncData(`doc-${route.path}`, () => queryCollection('docs').path(path.value).first())
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Documentation page not found' })
}

const { data: navigation } = await useAsyncData('docs-navigation', () => queryCollectionNavigation('docs', ['description', 'badge']))
const { data: surround } = await useAsyncData(`surround-${route.path}`, () => queryCollectionItemSurroundings('docs', path.value, {
  fields: ['title', 'description'],
}))

const open = useState('docs-mobile-nav-open', () => false)
const tocLinks = computed(() => page.value?.body?.toc?.links ?? [])

const sectionTitle = computed(() => {
  const segments = path.value.split('/').filter(Boolean)
  const section = segments.at(-2) ?? 'Documentation'
  return section.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
})

useSeoMeta({
  title: () => `${page.value?.title ?? 'Docs'} — NSDB`,
  description: () => page.value?.description,
  ogTitle: () => `${page.value?.title ?? 'Docs'} — NSDB`,
  ogDescription: () => page.value?.description,
})

function closeMobileNav() {
  open.value = false
}
</script>

<template>
  <div>
    <DocsSearch />
    <div class="docs-layout">
      <aside class="docs-sidebar" aria-label="Documentation navigation">
        <p class="sidebar-title">Documentation</p>
        <nav class="docs-nav">
          <DocsNavTree :items="(navigation ?? []) as ContentNavigationItem[]" />
        </nav>
      </aside>

      <article class="docs-article">
        <div class="mobile-docs-nav">
          <UButton
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-panel-left"
            :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :aria-expanded="open"
            @click="open = !open"
          >
            Browse documentation
          </UButton>
          <nav v-if="open" class="docs-nav" aria-label="Mobile documentation navigation" @click="closeMobileNav">
            <DocsNavTree :items="(navigation ?? []) as ContentNavigationItem[]" />
          </nav>
        </div>

        <div class="breadcrumbs" aria-label="Breadcrumb">
          <span><NuxtLink to="/docs/getting-started/introduction">Docs</NuxtLink></span>
          <span>{{ sectionTitle }}</span>
          <span aria-current="page">{{ page?.title }}</span>
        </div>

        <header class="docs-header">
          <div v-if="page?.badge" style="margin-bottom: .75rem"><ApiBadge>{{ page.badge }}</ApiBadge></div>
          <h1>{{ page?.title }}</h1>
          <p class="docs-description">{{ page?.description }}</p>
        </header>

        <ContentRenderer v-if="page" :value="page" class="prose" />

        <nav v-if="surround?.some(Boolean)" class="docs-surround" aria-label="Previous and next pages">
          <NuxtLink v-if="surround?.[0]" :to="surround[0].path" class="surround-link">
            <Icon name="i-lucide-arrow-left" aria-hidden="true" />
            <span><small>Previous</small>{{ surround[0].title }}</span>
          </NuxtLink>
          <span v-else />
          <NuxtLink v-if="surround?.[1]" :to="surround[1].path" class="surround-link">
            <span><small>Next</small>{{ surround[1].title }}</span>
            <Icon name="i-lucide-arrow-right" aria-hidden="true" />
          </NuxtLink>
        </nav>
      </article>

      <aside class="docs-toc" aria-label="On this page">
        <p class="toc-title">On this page</p>
        <ul v-if="tocLinks.length" class="toc-links">
          <template v-for="link in tocLinks" :key="link.id">
            <li><a :href="`#${link.id}`">{{ link.text }}</a></li>
            <li v-for="child in link.children ?? []" :key="child.id">
              <a :href="`#${child.id}`" class="depth-3">{{ child.text }}</a>
            </li>
          </template>
        </ul>
        <p v-else class="search-hint">Short page</p>
      </aside>
    </div>
  </div>
</template>
