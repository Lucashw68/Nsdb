<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'

console.warn('[NsdbList] UPDATED PAGINATED VERSION WITH VARIANT + RENDERLESS')

type Column = {
  key: string
  label: string
  format?: (value: any, row: any) => string
}

type NsdbTableClasses = {
  wrapper: string
  headerWrapper: string
  headerTitle: string
  headerSubtitle: string
  error: string
  tableContainer: string
  table: string
  thead: string
  theadRow: string
  th: string
  actionsTh: string
  loadingCell: string
  emptyCell: string
  bodyRow: string
  td: string
  actionsTd: string
  deleteButton: string
  footer: string
}

const defaultClasses: NsdbTableClasses = {
  wrapper: 'w-full space-y-3',
  headerWrapper: 'flex items-center justify-between',
  headerTitle: 'text-lg font-semibold capitalize mb-2',
  headerSubtitle: 'text-sm opacity-70',
  error: 'text-sm text-red-600',
  tableContainer: 'border w-full overflow-x-auto',
  table: 'nsdb-table w-full text-sm',
  thead: 'bg-gray-50',
  theadRow: 'border-2 border-white',
  th: 'text-left text-black px-4 py-2 font-bold hover:cursor-pointer hover:text-purple-500 hover:bg-gray-200 hover:rounded-lg',
  actionsTh: 'text-black',
  loadingCell: 'px-4 py-6 text-center',
  emptyCell: 'px-4 py-6 text-center',
  bodyRow: 'border-t hover:bg-gray-400 hover:cursor-pointer',
  td: 'py-2 px-4 text-center border-2 border-white',
  actionsTd: 'flex items-center gap-2 py-2 px-4 justify-center',
  deleteButton: 'flex items-center rounded-full hover:bg-gray-600 px-2 py-1',
  footer: 'w-full flex justify-between items-center mt-2',
}

const props = defineProps<{
  model: string
  columns?: Column[]
  pageSize?: number
  query?: any
  classes?: Partial<NsdbTableClasses>
  unstyled?: boolean
  variant?: 'table' | 'cards'
}>()

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

const classes = computed<NsdbTableClasses>(() => {
  if (props.unstyled) {
    return Object.keys(defaultClasses).reduce((acc, key) => {
      // @ts-expect-error: key est bien une clé de NsdbTableClasses
      acc[key] = ''
      return acc
    }, {} as NsdbTableClasses)
  }

  return {
    ...defaultClasses,
    ...(props.classes ?? {}),
  }
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

async function handlePrevPage() {
  if (!canGoPrev.value) return
  await goToPage(currentPage.value - 1)
}

async function handleNextPage() {
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

async function handleDelete(row: any) {
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

    // On recharge la page courante après suppression
    await load()
  } catch (e) {
    console.error('[NsdbList] Error while deleting row:', e)
  }
}
</script>

<template>
  <!-- 🔧 Renderless default slot: expose all data / actions -->
  <slot
    :model="props.model"
    :rows="sortedRows"
    :raw-rows="rows"
    :columns="effectiveColumns"
    :loading="loading"
    :error="error"
    :current-page="currentPage"
    :page-size="pageSize"
    :can-go-prev="canGoPrev"
    :can-go-next="canGoNext"
    :go-to-page="goToPage"
    :prev-page="handlePrevPage"
    :next-page="handleNextPage"
    :delete-row="handleDelete"
  >
    <!-- 🔽 Default layout (table/cards) -->
    <div :class="classes.wrapper">
      <!-- HEADER -->
      <div :class="classes.headerWrapper">
        <slot
          name="header"
          :model="props.model"
          :rows="rows"
          :loading="loading"
          :error="error"
          :columns="effectiveColumns"
          :current-page="currentPage"
        >
          <div>
            <h3 :class="classes.headerTitle">
              {{ props.model }}
            </h3>
            <div
              v-if="rows.length"
              :class="classes.headerSubtitle"
            >
              {{ rows.length }} éléments (page {{ currentPage }})
            </div>
          </div>
        </slot>
      </div>

      <!-- ERROR -->
      <slot
        name="error"
        v-if="error"
        :error="error"
      >
        <div :class="classes.error">
          {{ error }}
        </div>
      </slot>

      <!-- CONTENT -->
      <!-- 🃏 CARDS VARIANT -->
      <div v-if="props.variant === 'cards'">
        <!-- LOADING -->
        <template v-if="loading">
          <slot name="loading" :columns="effectiveColumns">
            <div :class="classes.loadingCell">
              Chargement…
            </div>
          </slot>
        </template>

        <!-- EMPTY -->
        <template v-else-if="sortedRows.length === 0">
          <slot name="empty" :columns="effectiveColumns">
            <div :class="classes.emptyCell">
              Aucun résultat
            </div>
          </slot>
        </template>

        <!-- CARDS -->
        <template v-else>
          <slot
            name="cards"
            :rows="sortedRows"
            :columns="effectiveColumns"
          >
            <div class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="row in sortedRows"
                :key="row.id ?? JSON.stringify(row)"
                class="border rounded-lg p-4 shadow-sm bg-white"
              >
                <slot
                  name="card"
                  :row="row"
                  :columns="effectiveColumns"
                >
                  <div
                    v-for="column in effectiveColumns"
                    :key="column.key"
                    class="text-sm text-black mb-1"
                  >
                    <span class="font-semibold mr-1">
                      {{ column.label }}:
                    </span>
                    <span>
                      {{
                        column.format
                          ? column.format(getDeep(row, column.key), row)
                          : getDeep(row, column.key) ?? 'Inconnu'
                      }}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="mt-2 text-xs text-red-500 underline"
                    @click="handleDelete(row)"
                  >
                    Supprimer
                  </button>
                </slot>
              </div>
            </div>
          </slot>
        </template>
      </div>

      <!-- 📊 TABLE VARIANT (default) -->
      <div
        v-else
        :class="classes.tableContainer"
      >
        <table :class="classes.table">
          <thead :class="classes.thead">
            <slot name="thead" :columns="effectiveColumns">
              <tr :class="classes.theadRow">
                <th
                  v-for="column in effectiveColumns"
                  :key="column.key"
                  :class="classes.th"
                  @click="toggleSort(column)"
                >
                  <slot
                    name="th"
                    :column="column"
                    :sort-key="sortState.key"
                    :sort-direction="sortState.direction"
                    :toggle-sort="() => toggleSort(column)"
                  >
                    {{ column.label }}
                    <span v-if="sortState.key === column.key">
                      <span v-if="sortState.direction === 'asc'">▲</span>
                      <span v-else-if="sortState.direction === 'desc'">▼</span>
                    </span>
                  </slot>
                </th>

                <th :class="classes.actionsTh">
                  Actions
                </th>
              </tr>
            </slot>
          </thead>

          <tbody>
            <!-- LOADING -->
            <template v-if="loading">
              <slot name="loading" :columns="effectiveColumns">
                <tr>
                  <td
                    :colspan="effectiveColumns.length || 1"
                    :class="classes.loadingCell"
                  >
                    Chargement…
                  </td>
                </tr>
              </slot>
            </template>

            <!-- EMPTY -->
            <template v-else-if="sortedRows.length === 0">
              <slot name="empty" :columns="effectiveColumns">
                <tr>
                  <td
                    :colspan="effectiveColumns.length || 1"
                    :class="classes.emptyCell"
                  >
                    Aucun résultat
                  </td>
                </tr>
              </slot>
            </template>

            <!-- BODY -->
            <template v-else>
              <slot
                name="body"
                :rows="sortedRows"
                :columns="effectiveColumns"
              >
                <tr
                  v-for="row in sortedRows"
                  :key="row.id ?? JSON.stringify(row)"
                  :class="classes.bodyRow"
                >
                  <td
                    v-for="column in effectiveColumns"
                    :key="column.key"
                    :class="classes.td"
                  >
                    <slot
                      name="cell"
                      :row="row"
                      :column="column"
                      :value="
                        column.format
                          ? column.format(getDeep(row, column.key), row)
                          : (getDeep(row, column.key) ?? 'Inconnu')
                      "
                    >
                      {{
                        column.format
                          ? column.format(getDeep(row, column.key), row)
                          : getDeep(row, column.key) ?? 'Inconnu'
                      }}
                    </slot>
                  </td>

                  <td :class="classes.actionsTd">
                    <button
                      type="button"
                      @click="handleDelete(row)"
                      :class="classes.deleteButton"
                    >
                      <Icon
                        name="mdi:trash"
                        class="w-4 h-4 text-red-500"
                      />
                    </button>
                  </td>
                </tr>
              </slot>
            </template>
          </tbody>
        </table>
      </div>

      <!-- FOOTER / PAGINATION -->
      <div :class="classes.footer">
        <slot
          name="footer"
          :rows="rows"
          :columns="effectiveColumns"
          :model="props.model"
          :current-page="currentPage"
          :can-go-prev="canGoPrev"
          :can-go-next="canGoNext"
          :go-to-page="goToPage"
          :prev-page="handlePrevPage"
          :next-page="handleNextPage"
        >
          <div class="text-sm opacity-70">
            Page {{ currentPage }}
            <span v-if="pageSize"> — {{ rows.length }} éléments sur cette page</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1 rounded border text-sm disabled:opacity-40"
              :disabled="!canGoPrev || loading"
              @click="handlePrevPage"
            >
              Précédent
            </button>

            <button
              type="button"
              class="px-3 py-1 rounded border text-sm disabled:opacity-40"
              :disabled="!canGoNext || loading"
              @click="handleNextPage"
            >
              Suivant
            </button>
          </div>
        </slot>
      </div>
    </div>
  </slot>
</template>

<style scoped>
@reference "tailwindcss";

.nsdb-table {
  width: 100% !important;
  max-width: 100%;
  table-layout: auto;
  width: -webkit-fill-available;
  width: -moz-available;
  width: stretch;
  max-width: 100%;
}
</style>
