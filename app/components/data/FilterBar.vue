<script setup lang="ts">
/**
 * Suchfeld und Filter über einer Liste.
 *
 * Das Suchfeld hat einen **echten Namen** für Screenreader, keinen Platzhalter
 * als Ersatz — beim Vorgänger hatten fünf Suchfelder gar keinen (B-093). Und
 * getippt wird immer entprellt, unabhängig davon, ob jemand zuhört (B-114);
 * das erledigt `useListQuery`.
 */
const search = defineModel<string>('search', { required: true })

const props = withDefaults(defineProps<{
  /** Wonach gesucht wird — wird der Beschriftung angehängt. */
  searchLabel?: string
  placeholder?: string
  /** Ob überhaupt ein Filter gesetzt ist. Blendet „Zurücksetzen" ein. */
  filtered?: boolean
  total?: number
}>(), {
  searchLabel: 'Suchen',
  placeholder: 'Suchen …',
  filtered: false,
})

const emit = defineEmits<{ reset: [] }>()

const inputId = useId()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 pb-3">
    <div class="flex min-w-0 grow items-center gap-2">
      <label
        :for="inputId"
        class="sr-only"
      >{{ props.searchLabel }}</label>
      <UInput
        :id="inputId"
        v-model="search"
        type="search"
        icon="i-lucide-search"
        :placeholder="props.placeholder"
        class="w-full max-w-sm"
        data-testid="filter-search"
      />
    </div>

    <slot />

    <span
      v-if="props.total !== undefined"
      class="text-sm text-muted tabular-nums"
      data-testid="filter-total"
    >
      {{ props.total }} {{ props.total === 1 ? 'Eintrag' : 'Einträge' }}
    </span>

    <UButton
      v-if="props.filtered"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      data-testid="filter-reset"
      @click="emit('reset')"
    >
      Zurücksetzen
    </UButton>
  </div>
</template>
