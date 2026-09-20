<script setup lang="ts">
/**
 * Ein Datumsfeld.
 *
 * Nach außen eine Zeichenkette `YYYY-MM-DD`, wie sie in der Datenbank steht.
 * Nach innen das Datumsobjekt, das Nuxt UI erwartet. Die Umrechnung läuft
 * **ohne** `Date` — wer ein `Date` dazwischenschaltet, verliert bei Mitternacht
 * UTC einen Tag, und genau daraus entstehen Rechnungen mit falschem
 * Leistungsdatum.
 */
import { fromCalendarDate, toCalendarDate } from '#shared/calendar-date'
import type { CalendarDate } from '@internationalized/date'

const value = defineModel<string | null>({ default: null })

const props = withDefaults(defineProps<{
  label?: string
  /** Für den Testselektor und das Formularfeld. */
  name?: string
  disabled?: boolean
  required?: boolean
}>(), {
  disabled: false,
  required: false,
})

/** Der Zwischenstand für den Kalender. Leer bleibt leer. */
const calendar = computed({
  get: () => toCalendarDate(value.value),
  set: (next: CalendarDate | null) => {
    value.value = fromCalendarDate(next)
  },
})
</script>

<template>
  <UFormField
    :label="props.label"
    :name="props.name"
    :required="props.required"
  >
    <UInputDate
      v-model="calendar"
      :disabled="props.disabled"
      class="w-full"
      :data-testid="props.name ? `date-${props.name}` : 'date-field'"
    />
  </UFormField>
</template>
