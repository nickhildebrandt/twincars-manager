<script setup lang="ts">
/**
 * Eine Liste, die nicht geladen werden konnte.
 *
 * Der deutsche Satz stand schon im Toast; hier steht, dass die Anzeige
 * womöglich veraltet ist, und ein Knopf zum erneuten Versuch. Eine leere
 * Tabelle ohne Erklärung sieht aus wie „nichts vorhanden" — und das ist etwas
 * ganz anderes.
 */
const emit = defineEmits<{ retry: [] }>()

defineProps<{ stale?: boolean }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 px-6 py-10 text-center"
    data-testid="error-state"
  >
    <UIcon
      name="i-lucide-cloud-off"
      class="size-7 text-error"
    />
    <p class="font-medium">
      Die Liste konnte nicht geladen werden
    </p>
    <p class="max-w-md text-sm text-muted">
      <template v-if="stale">
        Angezeigt wird der zuletzt geladene Stand. Er kann veraltet sein.
      </template>
      <template v-else>
        Bitte versuchen Sie es erneut.
      </template>
    </p>
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-refresh-cw"
      data-testid="error-retry"
      @click="emit('retry')"
    >
      Erneut laden
    </UButton>
  </div>
</template>
