<template>
    <div class="p-8">
        <span id="float-nav">
            <NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
        </span>

        <h1 class="text-4xl font-bold mb-4 mt-4">👁️ NSDB Components</h1>

        <div class="flex flex-col gap-4">
            <div class="nsdb-component">
                <h2 class="mb-4 text-xl font-semibold">List component <code class="font-mono text-[0.9em] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{{ '<NsdbList />' }}</code></h2>
                <div class="mb-4 text-sm text-gray-600">
                    <p>This component displays a list of items from the specified model with customizable columns and pagination, filtering and sorting.</p>
                    <p>Named slots are available to fully customize the display of the list</p>
                </div>
                <hr class="mb-4" />
                <NsdbList
                    model="playlists"
                    :columns="[
                        { key: 'id', label: 'ID' },
                        { key: 'title', label: 'Titre' },
                        { key: 'provider', label: 'Provider' },
                        { key: 'item_count', label: 'Nombre d\'éléments' },
                        { key: 'profile.username', label: 'Utilisateur' },
                        { key: 'created_at', label: 'Créé le', format: v => new Date(v).toLocaleDateString() }
                    ]"
                    :page-size="2"
                    searchable
                    :search-columns="['title']"
                    sort-by="created_at"
                    sort-direction="desc"
                />
                <hr class="my-4" />
                <NsdbList
                    model="songs"
                    :variant="'cards'"
                    :columns="[
                        { key: 'id', label: 'ID' },
                        { key: 'title', label: 'Titre' },
                        { key: 'playlist.title', label: 'Playlist' },
                        { key: 'profile.username', label: 'Utilisateur' },
                        { key: 'created_at', label: 'Créé le', format: v => new Date(v).toLocaleDateString() }
                    ]"
                    :page-size="2"
                    searchable
                    :search-columns="['title']"
                    sort-by="created_at"
                    sort-direction="desc"
                />
                <hr class="my-4" />
                <NsdbList
                    model="songs"
                    variant="cards"
                    v-slot:card="{ row, columns }"
                    :columns="[
                        { key: 'id', label: 'ID' },
                        { key: 'title', label: 'Titre' },
                        { key: 'playlist.title', label: 'Playlist' },
                        { key: 'profile.username', label: 'Utilisateur' },
                        { key: 'created_at', label: 'Créé le', format: v => new Date(v).toLocaleDateString() }
                    ]"
                    :page-size="2"
                    sort-by="created_at"
                    sort-direction="desc"
                >
                    <div class="border rounded shadow bg-purple-100 text-black">
                        <h3 class="font-bold">{{ row.title }}</h3>
                        <p>{{ row.profile.username }}</p>
                        <p class="text-xs opacity-70">
                            Playlist : {{ row.playlist?.title ?? '—' }}
                        </p>
                    </div>
                </NsdbList>
                <div @click="showNsdbListDoc = !showNsdbListDoc" class="text-sm text-purple-500 cursor-pointer mt-4">⬇️ Show documentation</div>

                <ContentRenderer v-if="showNsdbListDoc && nsdbListDoc" :value="nsdbListDoc" class="prose prose-slate max-w-none nsdb-doc" />
            </div>

            <div class="nsdb-component">
                <h2 class="mb-8 text-xl font-semibold">Form component</h2>
                <div class="mb-4 text-sm text-gray-600">
                    <p>This component provides a form interface for creating or updating records in the specified model. It dynamically generates form fields based on the model's schema and handles form submission with validation and error handling.</p>
                    <p>It emits events upon successful submission or error occurrence, allowing parent components to respond accordingly.</p>
                </div>
                <hr class="mb-4" />
                <NsdbForm
                    model="songs"
                    :id="formModelId"
                    :hide-fields="['id', 'profile_id', 'created_at', 'updated_at', 'bucket_path', 'resource_id', 'provider_id']"
                    :initial-values="{
                        title: '',
                        profile_id: '06cc776b-4f42-40f6-9c33-707bf13d247a',
                        'playlist.profile_id': '06cc776b-4f42-40f6-9c33-707bf13d247a',
                        resource_id: ''
                    }"
                    :labels="[
                        { key: 'id', label: 'ID' },
                        { key: 'title', label: 'Titre' },
                        { key: 'playlist_id', label: 'Playlist' }
                    ]"
                    @saved="song => console.log('Saved', song)"
                />
                <div @click="showNsdbFormDoc = !showNsdbFormDoc" class="text-sm text-purple-500 cursor-pointer mt-4">⬇️ Show documentation</div>

                <ContentRenderer v-if="showNsdbFormDoc && nsdbFormDoc" :value="nsdbFormDoc" class="prose prose-slate max-w-none nsdb-doc" />
            </div>
        </div>

    </div>
</template>

<script setup>
const { data: nsdbListDoc } = await useAsyncData('nsdb-list-doc', () => queryCollection('components').path('/components/nsdblist').first())
const { data: nsdbFormDoc } = await useAsyncData('nsdb-form-doc', () => queryCollection('components').path('/components/nsdbform').first())

const showNsdbListDoc = ref(false)
const showNsdbFormDoc = ref(false)

const formModelId = null
// const formModelId = '32a44986-6061-47ef-8878-5dd300f433df'
</script>

<style scoped>
.nsdb-component {
    @apply
    p-8
    my-4
    border-2
    border-gray-200;
}
</style>
