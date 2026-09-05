<script setup lang="ts">
defineProps<{ icon: string; title: string }>()
</script>

<template>
  <article class="feature-card">
    <Icon :name="icon" aria-hidden="true" />
    <h3>{{ title }}</h3>
    <div><slot /></div>
  </article>
</template>
