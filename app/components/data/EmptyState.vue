<script setup lang="ts">
/**
 * Eine Liste ohne Treffer — auf `UEmpty`.
 *
 * Die Darstellung kommt vollständig von Nuxt UI. Diese Datei fügt nichts
 * hinzu außer der **Unterscheidung zweier Fälle**, die verschiedene Antworten
 * brauchen: noch nichts angelegt (dann hilft ein Knopf zum Anlegen) oder
 * nichts gefunden (dann hilft ein Knopf zum Zurücksetzen des Filters).
 *
 * Der Wortlaut steht hier und nicht an jeder Aufrufstelle, damit er überall
 * derselbe ist.
 */
const props = withDefaults(defineProps<{
  /** Was gesucht wurde. Leer heißt: es ist wirklich noch nichts da. */
  filtered?: boolean
  title?: string
  description?: string
  icon?: string
  /** Solange geladen wird, zeigt `UEmpty` den Spinner statt des Symbols. */
  loading?: boolean
}>(), {
  filtered: false,
  icon: 'i-lucide-inbox',
  loading: false,
})

const emit = defineEmits<{ reset: [] }>()

const heading = computed(() =>
  props.title ?? (props.filtered ? 'Keine Treffer' : 'Noch nichts vorhanden'))

const text = computed(() =>
  props.description ?? (props.filtered
    ? 'Zu dieser Suche gibt es nichts. Ändern Sie den Filter oder setzen Sie ihn zurück.'
    : 'Sobald der erste Eintrag angelegt ist, steht er hier.'))

/** Nur im gefilterten Fall gibt es etwas zu tun. */
const actions = computed(() => props.filtered
  ? [{
      label: 'Filter zurücksetzen',
      icon: 'i-lucide-rotate-ccw',
      color: 'neutral' as const,
      variant: 'outline' as const,
      onClick: () => emit('reset'),
    }]
  : [])
</script>

<template>
  <UEmpty
    :icon="props.icon"
    :title="heading"
    :description="text"
    :loading="props.loading"
    :actions="actions"
    data-testid="empty-state"
  >
    <template
      v-if="$slots.default"
      #footer
    >
      <slot />
    </template>
  </UEmpty>
</template>
