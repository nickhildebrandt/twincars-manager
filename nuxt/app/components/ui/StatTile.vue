<script setup lang="ts">
/**
 * Eine Kennzahl.
 *
 * Bewusst schmucklos: Zahl, Bezeichnung, und wenn es hilft, der Vergleich zum
 * Vorzeitraum. Kennzahlen werden **gerechnet**, nie zwischengespeichert
 * (P-09) — diese Komponente stellt nur dar, was ihr gereicht wird.
 */
const props = withDefaults(defineProps<{
  label: string
  value: string
  /** Veränderung gegenüber dem Vorzeitraum, in Prozent. */
  change?: number
  hint?: string
  icon?: string
}>(), {})

/** Mehr ist nicht immer besser — die Farbe sagt nur „hoch" oder „runter". */
const direction = computed(() => {
  if (props.change === undefined || props.change === 0) return null
  return props.change > 0 ? 'up' : 'down'
})
</script>

<template>
  <div
    class="flex flex-col gap-1 rounded-md border border-default bg-default px-4 py-3"
    data-testid="stat-tile"
  >
    <div class="flex items-center gap-2 text-sm text-muted">
      <UIcon
        v-if="props.icon"
        :name="props.icon"
        class="size-4"
      />
      {{ props.label }}
    </div>

    <p
      class="text-2xl font-semibold tabular-nums"
      data-testid="stat-value"
    >
      {{ props.value }}
    </p>

    <p
      v-if="direction"
      class="flex items-center gap-1 text-sm tabular-nums"
      :class="direction === 'up' ? 'text-success' : 'text-error'"
      data-testid="stat-change"
    >
      <UIcon
        :name="direction === 'up' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
        class="size-4"
      />
      {{ props.change! > 0 ? '+' : '' }}{{ props.change }} %
    </p>

    <p
      v-if="props.hint"
      class="text-xs text-dimmed"
    >
      {{ props.hint }}
    </p>
  </div>
</template>
