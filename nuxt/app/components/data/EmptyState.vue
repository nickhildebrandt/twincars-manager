<script setup lang="ts">
/**
 * Eine Liste ohne Treffer.
 *
 * Unterscheidet zwei Fälle, weil sie verschiedene Antworten brauchen: noch
 * nichts angelegt (dann hilft ein Knopf zum Anlegen) oder nichts gefunden
 * (dann hilft ein Knopf zum Zurücksetzen des Filters).
 */
const props = withDefaults(defineProps<{
  /** Was gesucht wurde. Leer heißt: es ist wirklich noch nichts da. */
  filtered?: boolean
  title?: string
  description?: string
  icon?: string
}>(), {
  filtered: false,
  icon: 'i-lucide-inbox',
})

const emit = defineEmits<{ reset: [] }>()

const heading = computed(() =>
  props.title ?? (props.filtered ? 'Keine Treffer' : 'Noch nichts vorhanden'))

const text = computed(() =>
  props.description ?? (props.filtered
    ? 'Zu dieser Suche gibt es nichts. Ändern Sie den Filter oder setzen Sie ihn zurück.'
    : 'Sobald der erste Eintrag angelegt ist, steht er hier.'))
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 px-6 py-14 text-center"
    data-testid="empty-state"
  >
    <UIcon
      :name="props.icon"
      class="size-8 text-dimmed"
    />
    <p class="font-medium">
      {{ heading }}
    </p>
    <p class="max-w-md text-sm text-muted">
      {{ text }}
    </p>

    <UButton
      v-if="props.filtered"
      color="neutral"
      variant="outline"
      icon="i-lucide-rotate-ccw"
      data-testid="empty-reset"
      @click="emit('reset')"
    >
      Filter zurücksetzen
    </UButton>

    <slot />
  </div>
</template>
