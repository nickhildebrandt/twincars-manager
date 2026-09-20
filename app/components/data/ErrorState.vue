<script setup lang="ts">
/**
 * Eine Liste, die nicht geladen werden konnte — auf `UEmpty`.
 *
 * Zwei Fälle, weil sie verschieden schlimm sind: es gibt **gar nichts** zu
 * zeigen, oder es steht noch der zuletzt geladene Stand da. Im zweiten Fall
 * ist die Seite benutzbar, und das muss dabeistehen — sonst hält jemand
 * veraltete Zahlen für aktuelle.
 */
const props = withDefaults(defineProps<{
  /** Ob noch ein älterer Stand angezeigt wird. */
  stale?: boolean
}>(), { stale: false })

const emit = defineEmits<{ retry: [] }>()

const text = computed(() => props.stale
  ? 'Angezeigt wird der zuletzt geladene Stand. Er kann veraltet sein.'
  : 'Bitte versuchen Sie es erneut.')
</script>

<template>
  <UEmpty
    icon="i-lucide-cloud-off"
    title="Die Liste konnte nicht geladen werden"
    :description="text"
    :actions="[{
      label: 'Erneut laden',
      icon: 'i-lucide-refresh-cw',
      color: 'neutral' as const,
      variant: 'outline' as const,
      onClick: () => emit('retry'),
    }]"
    data-testid="error-state"
  />
</template>
