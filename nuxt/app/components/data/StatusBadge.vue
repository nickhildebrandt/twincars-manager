<script setup lang="ts">
/**
 * Ein Status als Marke.
 *
 * Beschriftung **und** Farbe kommen aus der Werteliste in `shared/domain.ts` —
 * nicht aus der aufrufenden Seite. Sonst hieße derselbe Status an zwei Stellen
 * verschieden, genau wie beim Vorgänger (B-011).
 */
import { labelOf } from '#shared/domain'
import type { Domain } from '#shared/domain'

const props = defineProps<{
  /** Die Werteliste, zu der der Wert gehört. */
  domain: Domain<string>
  value: string | null | undefined
  /** Farbe je Wert. Was hier fehlt, wird neutral dargestellt. */
  tones?: Record<string, 'success' | 'info' | 'warning' | 'error' | 'neutral'>
}>()

const label = computed(() => labelOf(props.domain, props.value))
const tone = computed(() => (props.value && props.tones?.[props.value]) || 'neutral')
</script>

<template>
  <UBadge
    :color="tone"
    variant="subtle"
    :data-testid="`status-${props.value ?? 'leer'}`"
  >
    {{ label }}
  </UBadge>
</template>
