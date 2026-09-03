<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
		</span>

		<h1 class="text-4xl font-bold mb-8 mt-4">Storage API</h1>

		<div class="grid gap-6 lg:grid-cols-[420px_1fr]">
			<section class="space-y-4">
				<label class="block">
					<span class="text-sm text-gray-400">Bucket</span>
					<input v-model="bucketName" type="text" class="mt-1 w-full rounded p-2 text-black" />
				</label>

				<label class="block">
					<span class="text-sm text-gray-400">Dossier</span>
					<input v-model="directoryPath" type="text" placeholder="covers" class="mt-1 w-full rounded p-2 text-black" />
				</label>

				<label class="block">
					<span class="text-sm text-gray-400">Chemin fichier</span>
					<input v-model="objectPath" type="text" placeholder="covers/image.png" class="mt-1 w-full rounded p-2 text-black" />
				</label>

				<input type="file" class="block w-full text-sm" @change="selectFile" />

				<div class="flex flex-wrap gap-2">
					<button class="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" @click="refreshFiles">
						Lister
					</button>
					<button class="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" @click="uploadFile">
						Upload
					</button>
					<button class="rounded bg-slate-600 px-3 py-2 text-sm font-semibold text-white" @click="downloadFile">
						Download
					</button>
					<button class="rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white" @click="createPublicUrl">
						Public URL
					</button>
					<button class="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" @click="createSignedUrl">
						Signed URL
					</button>
					<button class="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white" @click="removeFile">
						Remove
					</button>
				</div>
			</section>

			<section class="grid gap-4 lg:grid-cols-2">
				<div class="rounded bg-gray-800 p-4">
					<h2 class="mb-3 text-xl font-bold">Fichiers</h2>
					<ul v-if="files.length > 0" class="space-y-2">
						<li v-for="file in files" :key="file.name">
							<button class="w-full rounded bg-gray-700 px-3 py-2 text-left text-sm" @click="selectListedFile(file.name)">
								<span class="font-semibold">{{ file.name }}</span>
								<span v-if="file.metadata?.size" class="ml-2 text-gray-400">{{ formatBytes(file.metadata.size) }}</span>
							</button>
						</li>
					</ul>
					<p v-else class="text-sm text-gray-400">Aucun fichier chargé.</p>
				</div>

				<div class="rounded bg-gray-800 p-4">
					<h2 class="mb-3 text-xl font-bold">Résultat</h2>
					<pre class="max-h-[520px] overflow-auto whitespace-pre-wrap text-xs">{{ result }}</pre>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
	const storageApi = useSupabaseApiStorage()

	const bucketName = ref('samples')
	const directoryPath = ref('')
	const objectPath = ref('')
	const selectedFile = ref<File | null>(null)
	const files = ref<Array<{ name: string; metadata?: { size?: number } }>>([])
	const result = ref<unknown>(null)

	const currentObjectPath = computed(() => {
		if (objectPath.value.trim()) return storageApi.normalizePath(objectPath.value)
		return storageApi.joinPath(directoryPath.value, selectedFile.value?.name)
	})

	function selectFile(event: Event) {
		const input = event.target as HTMLInputElement
		selectedFile.value = input.files?.[0] ?? null

		if (selectedFile.value && !objectPath.value.trim()) {
			objectPath.value = storageApi.joinPath(directoryPath.value, selectedFile.value.name)
		}
	}

	function selectListedFile(fileName: string) {
		objectPath.value = storageApi.joinPath(directoryPath.value, fileName)
	}

	function formatBytes(bytes: number) {
		return new Intl.NumberFormat('fr-FR', {
			maximumFractionDigits: 1,
			style: 'unit',
			unit: 'byte',
			unitDisplay: 'short',
		}).format(bytes)
	}

	async function refreshFiles() {
		const response = await storageApi.list(bucketName.value, {
			path: directoryPath.value,
			orderBy: 'name',
			orderDirection: 'asc',
		})

		result.value = response
		if (response.success) files.value = response.data
	}

	async function uploadFile() {
		if (!selectedFile.value) {
			result.value = 'Sélectionne un fichier avant upload.'
			return
		}

		const response = await storageApi.upload(bucketName.value, currentObjectPath.value, selectedFile.value, {
			contentType: selectedFile.value.type || undefined,
			upsert: true,
		})

		result.value = response
		if (response.success) await refreshFiles()
	}

	async function downloadFile() {
		const response = await storageApi.download(bucketName.value, currentObjectPath.value)
		result.value = response

		if (response.success && import.meta.client) {
			window.open(URL.createObjectURL(response.data), '_blank')
		}
	}

	function createPublicUrl() {
		result.value = storageApi.getPublicUrl(bucketName.value, currentObjectPath.value)
	}

	async function createSignedUrl() {
		result.value = await storageApi.createSignedUrl(bucketName.value, currentObjectPath.value, 300)
	}

	async function removeFile() {
		const response = await storageApi.remove(bucketName.value, currentObjectPath.value)
		result.value = response
		if (response.success) await refreshFiles()
	}
</script>

<style>
#float-nav {
	position: absolute;
	top: 1rem;
	left: 3rem;
	font-size: 2rem;
}
</style>
