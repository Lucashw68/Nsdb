<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const mobileOpen = ref(false)

watch(() => route.fullPath, () => { mobileOpen.value = false })
</script>

<template>
  <header class="site-header">
    <div class="header-inner">
      <NuxtLink to="/" class="brand-link" aria-label="NSDB home">
        <BrandMark />
        <span>NSDB</span>
      </NuxtLink>

      <nav class="desktop-nav" aria-label="Main navigation">
        <NuxtLink to="/docs/getting-started/introduction">Docs</NuxtLink>
        <NuxtLink to="/docs/reference/public-api">API</NuxtLink>
      </nav>

      <div class="header-actions">
        <UBadge color="neutral" variant="subtle" class="version-badge">
          v{{ config.public.nsdbVersion }}
        </UBadge>
        <DocsSearchButton />
        <UButton
          :to="config.public.githubUrl"
          target="_blank"
          color="neutral"
          variant="ghost"
          icon="i-lucide-github"
          aria-label="NSDB on GitHub"
        />
        <ColorModeControl />
        <UButton
          class="mobile-menu-button"
          color="neutral"
          variant="ghost"
          :icon="mobileOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          :aria-expanded="mobileOpen"
          aria-controls="mobile-navigation"
          aria-label="Toggle navigation"
          @click="mobileOpen = !mobileOpen"
        />
      </div>
    </div>
    <nav v-if="mobileOpen" id="mobile-navigation" class="mobile-nav" aria-label="Mobile navigation">
      <NuxtLink to="/docs/getting-started/introduction">Documentation</NuxtLink>
      <NuxtLink to="/docs/reference/public-api">API reference</NuxtLink>
      <NuxtLink :to="config.public.githubUrl" target="_blank">GitHub</NuxtLink>
    </nav>
  </header>
</template>
