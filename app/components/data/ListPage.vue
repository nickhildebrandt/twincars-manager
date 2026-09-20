<script setup lang="ts">
/**
 * Der Rahmen jeder Listenseite: Titel, Filterleiste, Inhalt, Blätterleiste.
 *
 * Er entscheidet, was zu sehen ist — Liste, Leerzustand oder Fehlerhinweis —,
 * damit diese Entscheidung nicht in zwanzig Seiten je einmal getroffen wird.
 * Und er zeigt **nie** eine leere Tabelle, während neu geladen wird: das
 * vorige Ergebnis bleibt stehen, bis das nächste da ist.
 */
const props = withDefaults(defineProps<{
  title: string
  /** Wie viele Einträge es insgesamt gibt. */
  total: number
  page: number
  pageCount: number
  pageSize: number
  loading?: boolean
  failed?: boolean
  /** Wahr, wenn geladen wurde und nichts dabei herauskam. */
  empty?: boolean
  /** Wahr, wenn gesucht oder gefiltert wird. Ändert den Leerzustand. */
  filtered?: boolean
}>(), {
  loading: false,
  failed: false,
  empty: false,
  filtered: false,
})

const emit = defineEmits<{ page: [number], retry: [], reset: [] }>()

/** Zeigen, was da ist: erst bei einem Fehler ohne jedes Ergebnis der Hinweis. */
const showError = computed(() => props.failed && props.total === 0 && props.empty)
const showEmpty = computed(() => !showError.value && props.empty)
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">
        {{ props.title }}
      </h1>
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <UAlert
      v-if="props.failed && !showError"
      color="warning"
      variant="subtle"
      icon="i-lucide-cloud-off"
      title="Der angezeigte Stand kann veraltet sein."
      description="Das letzte Laden ist fehlgeschlagen."
      data-testid="list-stale"
    />

    <slot name="filters" />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <DataErrorState
        v-if="showError"
        @retry="emit('retry')"
      />
      <DataEmptyState
        v-else-if="showEmpty"
        :filtered="props.filtered"
        @reset="emit('reset')"
      >
        <slot name="empty-action" />
      </DataEmptyState>
      <div
        v-else
        class="p-2 sm:p-3"
      >
        <slot />
      </div>
    </UCard>

    <div
      v-if="props.pageCount > 1"
      class="flex justify-center"
    >
      <UPagination
        :page="props.page"
        :items-per-page="props.pageSize"
        :total="props.total"
        data-testid="pagination"
        @update:page="(to: number) => emit('page', to)"
      />
    </div>
  </UContainer>
</template>
