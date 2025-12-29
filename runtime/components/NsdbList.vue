<script setup lang="ts">
import { ref, watch, computed, useSlots } from 'vue'
import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'

type Column = {
  key: string
  label: string
  format?: (value: any, row: any) => any
}

const props = defineProps<{
  model: string
  columns?: Column[]
  pageSize?: number
  query?: any
  /**
   * Built-in variants:
   * - "table" (default)
   * - "list"
   *
   * Custom variants:
   * - any string + slot du même nom (#cards, #compact, etc.)
   */
  variant?: string
}>()

const slots = useSlots()

// -----------------------------------------------------
// State & logic
// -----------------------------------------------------

const loading = ref(false)
const error = ref<string | null>(null)

const nsdbModel = useNsdbModel(props.model, { store: false })

const rows = computed(() => nsdbModel.items.value)

const sortState = ref<{
  key: string | null
  direction: 'asc' | 'desc' | null
}>({
  key: null,
  direction: null,
})

const currentPage = ref(1)

const pageSize = computed(() => {
  if (props.pageSize != null) return props.pageSize
  return undefined
})

const canGoPrev = computed(() => currentPage.value > 1)

const canGoNext = computed(() => {
  if (!pageSize.value) {
    return rows.value.length > 0
  }
  // Heuristique : tant qu'on a un "plein" pageSize, on considère qu'il peut y avoir une page suivante
  return rows.value.length === pageSize.value
})

async function load() {
  loading.value = true
  error.value = null

  try {
    const baseQuery = props.query ?? {}

    const limit =
      pageSize.value ??
      baseQuery.limit ??
      100

    const offset =
      baseQuery.offset ??
      (currentPage.value - 1) * limit

    const finalQuery = {
      ...baseQuery,
      limit,
      offset,
    }

    await nsdbModel.all?.(finalQuery)
  } catch (e: any) {
    error.value = e?.message ?? 'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

async function goToPage(page: number) {
  if (page < 1) return
  currentPage.value = page
  await load()
}

async function prevPage() {
  if (!canGoPrev.value) return
  await goToPage(currentPage.value - 1)
}

async function nextPage() {
  if (!canGoNext.value) return
  await goToPage(currentPage.value + 1)
}

watch(
  () => [props.model, props.pageSize, props.query],
  () => {
    currentPage.value = 1
    load()
  },
  { immediate: true, deep: true }
)

const effectiveColumns = computed<Column[]>(() => {
  if (props.columns && props.columns.length > 0) {
    props.columns.forEach(column => {
      if (typeof column.key !== 'string') {
        console.warn('[NsdbList] column.key should be a string, got:', column.key)
      }
    })
    return props.columns
  }

  const first = rows.value[0]
  if (!first) return []

  return Object.keys(first).map(key => ({ key, label: key }))
})

function getDeep(row: any, path: unknown) {
  if (!row || path == null) return null

  if (Array.isArray(path)) {
    let current: any = row
    for (const part of path) {
      if (current == null) return null
      current = current[part as keyof typeof current]
    }
    return current
  }

  if (typeof path !== 'string') {
    console.warn('[NsdbList.getDeep] path is not a string:', path, 'typeof =', typeof path)
    return null
  }

  const segments = path.split('.')
  let current: any = row

  for (const segment of segments) {
    if (current == null) return null
    current = current[segment as keyof typeof current]
  }

  return current
}

function toggleSort(column: Column) {
  if (sortState.value.key !== column.key) {
    sortState.value = { key: column.key, direction: 'asc' }
    return
  }

  if (sortState.value.direction === 'asc') {
    sortState.value = { key: column.key, direction: 'desc' }
    return
  }

  sortState.value = { key: null, direction: null }
}

const sortedRows = computed(() => {
  const base = [...rows.value]

  const key = sortState.value.key
  const direction = sortState.value.direction

  if (!key || !direction) {
    return base
  }

  return base.sort((a, b) => {
    const valueA = getDeep(a, key)
    const valueB = getDeep(b, key)

    const stringA = valueA == null ? '' : String(valueA).toLowerCase()
    const stringB = valueB == null ? '' : String(valueB).toLowerCase()

    const comparison = stringA.localeCompare(stringB)
    return direction === 'asc' ? comparison : -comparison
  })
})

async function deleteRow(row: any) {
  const id = row?.id
  if (id == null) return

  try {
    if (typeof nsdbModel.delete === 'function') {
      await nsdbModel.delete(id)
    } else if (typeof nsdbModel.remove === 'function') {
      await nsdbModel.remove(id)
    } else {
      console.warn('[NsdbList] No delete/remove method found on nsdbModel for', props.model)
      return
    }

    await load()
  } catch (e) {
    console.error('[NsdbList] Error while deleting row:', e)
  }
}

// -----------------------------------------------------
// Variant resolution
// -----------------------------------------------------

const variantName = computed(() => props.variant ?? 'table')

const slotProps = computed(() => ({
  model: props.model,
  rows: sortedRows.value,
  rawRows: rows.value,
  columns: effectiveColumns.value,
  loading: loading.value,
  error: error.value,
  currentPage: currentPage.value,
  pageSize: pageSize.value,
  canGoPrev: canGoPrev.value,
  canGoNext: canGoNext.value,
  goToPage,
  prevPage,
  nextPage,
  deleteRow,
  sortState: sortState.value,
  toggleSort,
  getDeep,
}))

const hasDefaultSlot = computed(() => !!slots.default)
const hasVariantSlot = computed(
  () => !!slots[variantName.value as keyof typeof slots],
)
</script>

<template>
  <!-- 1. Full custom: v-slot="list" -->
  <slot
    v-if="hasDefaultSlot"
    v-bind="slotProps"
  />

  <!-- 2. App custom variant: <template #cards="list"> -->
  <slot
    v-else-if="hasVariantSlot"
    :name="variantName"
    v-bind="slotProps"
  />

  <!-- 3. Built-in TABLE variant -->
  <div
    v-else-if="variantName === 'table'"
    class="w-full space-y-3"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold capitalize">
        {{ slotProps.model }}
      </h3>
      <div class="text-xs opacity-70">
        Page {{ slotProps.currentPage }}
        <span v-if="slotProps.pageSize">
          — {{ slotProps.rows.length }} éléments
        </span>
      </div>
    </div>

    <div
      v-if="slotProps.error"
      class="text-sm text-red-600"
    >
      {{ slotProps.error }}
    </div>

    <div
      v-else-if="slotProps.loading"
      class="text-sm opacity-70"
    >
      Chargement…
    </div>

    <div
      v-else-if="slotProps.rows.length === 0"
      class="text-sm opacity-70"
    >
      Aucun résultat
    </div>

    <table
      v-else
      class="nsdb-table w-full text-sm border"
    >
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="column in slotProps.columns"
            :key="column.key"
            class="text-left px-4 py-2 font-bold cursor-pointer text-black hover:text-purple-500"
            @click="slotProps.toggleSort(column)"
          >
            {{ column.label }}
            <span v-if="slotProps.sortState.key === column.key">
              <span v-if="slotProps.sortState.direction === 'asc'">▲</span>
              <span v-else-if="slotProps.sortState.direction === 'desc'">▼</span>
            </span>
          </th>
          <th class="px-4 py-2">
            Actions
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="row in slotProps.rows"
          :key="row.id ?? JSON.stringify(row)"
          class="border-t hover:bg-gray-50"
        >
          <td
            v-for="column in slotProps.columns"
            :key="column.key"
            class="px-4 py-2"
          >
            {{
              column.format
                ? column.format(slotProps.getDeep(row, column.key), row)
                : slotProps.getDeep(row, column.key) ?? 'Inconnu'
            }}
          </td>
          <td class="px-4 py-2">
            <button
              type="button"
              class="text-xs text-red-500 underline"
              @click="slotProps.deleteRow(row)"
            >
              Supprimer
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="w-full flex justify-between items-center mt-2 text-sm">
      <div class="opacity-70">
        Page {{ slotProps.currentPage }}
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1 rounded border text-sm disabled:opacity-40"
          :disabled="!slotProps.canGoPrev || slotProps.loading"
          @click="slotProps.prevPage()"
        >
          Précédent
        </button>
        <button
          type="button"
          class="px-3 py-1 rounded border text-sm disabled:opacity-40"
          :disabled="!slotProps.canGoNext || slotProps.loading"
          @click="slotProps.nextPage()"
        >
          Suivant
        </button>
      </div>
    </div>
  </div>

  <!-- 4. Built-in LIST variant -->
  <div
    v-else-if="variantName === 'list'"
    class="w-full space-y-3 text-black"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold capitalize">
        {{ slotProps.model }}
      </h3>
      <div class="text-xs opacity-70">
        Page {{ slotProps.currentPage }}
      </div>
    </div>

    <div
      v-if="slotProps.error"
      class="text-sm text-red-600"
    >
      {{ slotProps.error }}
    </div>

    <div
      v-else-if="slotProps.loading"
      class="text-sm opacity-70"
    >
      Chargement…
    </div>

    <div
      v-else-if="slotProps.rows.length === 0"
      class="text-sm opacity-70"
    >
      Aucun résultat
    </div>

    <div
      v-else
      class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 text-black"
    >
      <article
        v-for="row in slotProps.rows"
        :key="row.id ?? JSON.stringify(row)"
        class="border rounded-lg p-4 shadow-sm bg-white"
      >
        <div
          v-for="column in slotProps.columns"
          :key="column.key"
          class="text-sm mb-1"
        >
          <span class="font-semibold mr-1">
            {{ column.label }}:
          </span>
          <span>
            {{
              column.format
                ? column.format(slotProps.getDeep(row, column.key), row)
                : slotProps.getDeep(row, column.key) ?? 'Inconnu'
            }}
          </span>
        </div>

        <button
          type="button"
          class="mt-2 text-xs text-red-500 underline"
          @click="slotProps.deleteRow(row)"
        >
          Supprimer
        </button>
      </article>
    </div>

    <div class="w-full flex justify-between items-center mt-2 text-sm">
      <div class="opacity-70">
        Page {{ slotProps.currentPage }}
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1 rounded border text-sm disabled:opacity-40"
          :disabled="!slotProps.canGoPrev || slotProps.loading"
          @click="slotProps.prevPage()"
        >
          Précédent
        </button>
        <button
          type="button"
          class="px-3 py-1 rounded border text-sm disabled:opacity-40"
          :disabled="!slotProps.canGoNext || slotProps.loading"
          @click="slotProps.nextPage()"
        >
          Suivant
        </button>
      </div>
    </div>
  </div>

  <!-- 5. Fallback pour un variant inconnu sans slot custom -->
  <pre v-else class="text-xs whitespace-pre-wrap bg-gray-100 p-2 rounded text-black">
Variant "{{ variantName }}" inconnu et aucun slot correspondant.
Données :
{{ JSON.stringify(slotProps.rows, null, 2) }}
  </pre>
</template>

<style scoped>
@reference "tailwindcss";

.nsdb-table {
  width: 100%;
  max-width: 100%;
  table-layout: auto;
}
</style>