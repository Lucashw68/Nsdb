<template>
  <main>
    <NsdbList model="profiles" unstyled />
    <NsdbForm model="profiles">
      <template #field-avatar_url="{ value, update }">
        <input :value="value" aria-label="Avatar URL" @input="update(($event.target as HTMLInputElement).value)" />
      </template>
    </NsdbForm>
  </main>
</template>

<script setup lang="ts">
import { useSupabaseApi } from '@lucashw68/nsdb/useSupabaseApi'
import { useSupabaseApiStorage } from '@lucashw68/nsdb/useSupabaseApiStorage'

const profiles = useProfiles()
const api = useSupabaseApi()
const storage = useSupabaseApiStorage()
// @ts-expect-error pre-1.0 low-level aliases are removed
void api.show('profiles', 'id')

async function directMode(id: string, file: File) {
  await profiles.fetch()
  await profiles.refresh()
  await profiles.update(id, { display_name: 'Ada' })
  await storage.upload('avatars', storage.joinPath('users', id, file.name), file)
  await api.getById('profiles', id)
}

void directMode
</script>
