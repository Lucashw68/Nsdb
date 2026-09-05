<script setup lang="ts">
const colorMode = useColorMode()
const options = [
  { label: 'System', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Light', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Dark', value: 'dark', icon: 'i-lucide-moon' },
]

const currentIndex = computed(() => Math.max(0, options.findIndex(option => option.value === colorMode.preference)))
const current = computed(() => options[currentIndex.value]!)

function cycle() {
  colorMode.preference = options[(currentIndex.value + 1) % options.length]!.value
}
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    :icon="current.icon"
    :aria-label="`Color mode: ${current.label}. Activate to change.`"
    @click="cycle"
  />
</template>
