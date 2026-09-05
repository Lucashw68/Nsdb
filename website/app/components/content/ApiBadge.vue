<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <span class="api-badge"><slot>{{ label }}</slot></span>
</template>
