<script setup lang="ts">
/**
 * Ein Geldfeld.
 *
 * Nach außen **ganze Cent**, wie überall in der Anwendung (E-10). Nach innen
 * das, was jemand tippt: `1.234,56`, `1234,56`, `1234.56`, mit oder ohne Euro.
 *
 * Umgerechnet wird erst, wenn das Feld verlassen wird — sonst springt die
 * Eingabe unter den Fingern. Was sich nicht lesen lässt, bleibt stehen und
 * wird als Fehler gemeldet, statt still zu einer Null zu werden.
 */
import { formatAmount, parseEuro } from '#shared/money'

const value = defineModel<number | null>({ default: null })

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  disabled?: boolean
  required?: boolean
}>(), {
  disabled: false,
  required: false,
})

const text = ref(value.value === null ? '' : formatAmount(value.value))
const invalid = ref(false)

// Von außen gesetzt — etwa beim Laden des Formulars.
watch(value, (next) => {
  if (invalid.value) return
  text.value = next === null ? '' : formatAmount(next)
})

function commit(): void {
  const raw = text.value.trim()
  if (raw === '') {
    invalid.value = false
    value.value = null
    return
  }

  const cents = parseEuro(raw)
  if (cents === null) {
    invalid.value = true
    return
  }

  invalid.value = false
  value.value = cents
  text.value = formatAmount(cents)
}
</script>

<template>
  <UFormField
    :label="props.label"
    :name="props.name"
    :required="props.required"
    :error="invalid ? 'Bitte einen Betrag wie 1.234,56 eingeben.' : undefined"
  >
    <UInput
      v-model="text"
      :disabled="props.disabled"
      inputmode="decimal"
      class="w-full"
      :data-testid="props.name ? `money-${props.name}` : 'money-field'"
      @blur="commit"
      @keydown.enter="commit"
    >
      <template #trailing>
        <span class="text-sm text-muted">€</span>
      </template>
    </UInput>
  </UFormField>
</template>
