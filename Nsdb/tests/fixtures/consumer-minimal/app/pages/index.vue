<template>
  <main>
    <NsdbList model="todos" />
    <NsdbForm model="todos" />
  </main>
</template>

<script setup lang="ts">
const todos = useTodos()

async function crud(id: string) {
  await todos.fetch()
  const created = await todos.create({ title: 'Ship NSDB' })
  await todos.update(created, { completed: true })
  await todos.remove(created)

  await todos.update(id, { completed: false })
  await todos.remove(id)
}

void crud
</script>
