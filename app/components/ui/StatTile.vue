<script setup lang="ts">
/**
 * Eine Kennzahl — auf `UPageCard`.
 *
 * Kennzahlen werden **gerechnet**, nie zwischengespeichert (P-09); diese
 * Komponente stellt nur dar, was ihr gereicht wird.
 *
 * Die Kachel selbst ist Nuxt UI. Eigen ist hier nur eines, und es ist
 * Fachlichkeit, keine Gestaltung: **mehr ist nicht immer besser.** Die Farbe
 * der Veränderung sagt „hoch" oder „runter", nicht „gut" oder „schlecht" —
 * bei den offenen Posten ist ein Plus das Gegenteil von einer guten Nachricht.
 */
const props = defineProps<{
  label: string
  value: string
  /** Veränderung gegenüber dem Vorzeitraum, in Prozent. */
  change?: number
  hint?: string
  icon?: string
  /** Solange gerechnet wird, steht ein Platzhalter statt einer falschen Zahl. */
  loading?: boolean
}>()

const direction = computed(() => {
  if (props.change === undefined || props.change === 0) return null
  return props.change > 0 ? 'up' : 'down'
})
</script>

<template>
  <UPageCard
    :title="props.label"
    :icon="props.icon"
    :description="props.hint"
    variant="outline"
    data-testid="stat-tile"
  >
    <USkeleton
      v-if="props.loading"
      class="h-8 w-24"
      data-testid="stat-loading"
    />
    <p
      v-else
      class="text-2xl font-semibold tabular-nums"
      data-testid="stat-value"
    >
      {{ props.value }}
    </p>

    <UBadge
      v-if="direction && !props.loading"
      :color="direction === 'up' ? 'success' : 'error'"
      variant="subtle"
      :icon="direction === 'up' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
      class="w-fit tabular-nums"
      data-testid="stat-change"
      :label="`${props.change! > 0 ? '+' : ''}${props.change} %`"
    />
  </UPageCard>
</template>
