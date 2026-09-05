<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

defineProps<{ items: ContentNavigationItem[] }>()
</script>

<template>
  <ul>
    <li v-for="item in items" :key="item.path">
      <NuxtLink v-if="item.path && !item.children?.length" :to="item.path">{{ item.title }}</NuxtLink>
      <span v-else>{{ item.title }}</span>
      <DocsNavTree v-if="item.children?.length" :items="item.children" />
    </li>
  </ul>
</template>
