<script setup lang="ts">
const props = withDefaults(defineProps<{ type?: 'note' | 'tip' | 'warning' | 'danger'; title?: string }>(), {
  type: 'note',
})
const icons = { note: 'i-lucide-info', tip: 'i-lucide-lightbulb', warning: 'i-lucide-triangle-alert', danger: 'i-lucide-circle-alert' }
</script>

<template>
  <aside :class="['doc-callout', `doc-callout-${props.type}`]">
    <Icon :name="icons[props.type]" aria-hidden="true" />
    <div>
      <strong v-if="title">{{ title }}</strong>
      <slot />
    </div>
  </aside>
</template>
