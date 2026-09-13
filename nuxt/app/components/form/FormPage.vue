<script setup lang="ts">
/**
 * Der Rahmen jedes Formulars: Titel, Felder, Fehlerzusammenfassung,
 * Speicherleiste.
 *
 * Vier Zusagen aus [04-ux.md](../../../../docs/rewrite/04-ux.md) §3.8 stehen
 * hier an **einer** Stelle, damit sie nicht in vierzig Formularen je einmal
 * getroffen werden müssen:
 *
 *   - **Speichern wird nie wegen fehlender Eingaben gesperrt.** Nur die
 *     laufende Anfrage sperrt. Ein toter Knopf sagt nicht, was fehlt; eine
 *     Fehlerliste schon.
 *   - **Geprüft wird beim Klick**, nicht beim Tippen: die Meldungen kommen
 *     zusammen, oben als Liste und unten am Feld.
 *   - **Die Liste führt zum Feld.** Jeder Eintrag ist ein Verweis auf die
 *     Eingabe, die ihn ausgelöst hat.
 *   - **Ungespeicherte Änderungen** werden beim Verlassen abgefragt; das
 *     Speichern meldet vorher „sauber", sonst bricht die Abfrage die eigene
 *     Weiterleitung ab (B-038).
 *
 * `novalidate` steht bewusst am Formular: sonst zeigt der Browser seine
 * eigenen, englischen Blasen.
 */
import { labelForPath } from '#shared/schemas/field-labels'

const props = withDefaults(defineProps<{
  title: string
  /** Feldfehler aus einer 422-Antwort oder aus der Prüfung beim Klick. */
  errors?: Record<string, string>
  /** Beschriftung der speichernden Schaltfläche. */
  submitLabel?: string
  cancelLabel?: string
  /** Wohin „Abbrechen" führt. Ohne Angabe wird nur ein Ereignis gemeldet. */
  cancelTo?: string
  /** Ein echter Modus-Riegel — etwa ein ausgestellter Beleg. Kein Prüfergebnis. */
  locked?: boolean
  lockedReason?: string
}>(), {
  errors: () => ({}),
  submitLabel: 'Speichern',
  cancelLabel: 'Abbrechen',
  locked: false,
})

const emit = defineEmits<{ submit: [], cancel: [] }>()

const busy = useBusy()

const entries = computed(() =>
  Object.entries(props.errors).map(([path, message]) => ({
    path,
    label: labelForPath(path),
    message,
  })))

const summaryId = useId()

/**
 * Ein Klick in der Zusammenfassung springt zum Feld, das gemeint ist.
 *
 * Kein Server-Zweig nötig: gerufen wird das nur aus einem Klick, und den gibt
 * es nur im Browser.
 */
function focusField(path: string): void {
  const field = document.querySelector<HTMLElement>(`[name="${path}"], #${CSS.escape(path)}`)
  field?.focus()
  field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
</script>

<template>
  <UContainer class="flex flex-col gap-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">
        {{ props.title }}
      </h1>
      <slot name="actions" />
    </div>

    <UAlert
      v-if="props.locked"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Dieser Datensatz lässt sich nicht mehr ändern."
      :description="props.lockedReason"
      data-testid="form-locked"
    />

    <form
      novalidate
      class="flex flex-col gap-4"
      data-testid="form"
      @submit.prevent="emit('submit')"
    >
      <UAlert
        v-if="entries.length > 0"
        :id="summaryId"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Bitte prüfen Sie Ihre Eingaben."
        data-testid="form-errors"
      >
        <template #description>
          <ul class="mt-1 flex flex-col gap-1">
            <li
              v-for="entry in entries"
              :key="entry.path"
            >
              <button
                type="button"
                class="text-left underline underline-offset-2"
                :data-testid="`form-error-${entry.path}`"
                @click="focusField(entry.path)"
              >
                {{ entry.label }}: {{ entry.message }}
              </button>
            </li>
          </ul>
        </template>
      </UAlert>

      <UCard>
        <slot />
      </UCard>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :to="props.cancelTo"
          data-testid="form-cancel"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel }}
        </UButton>

        <!--
          Gesperrt wird nur von der laufenden Anfrage und vom Modus-Riegel.
          Niemals von einem Prüfergebnis: was fehlt, sagt die Liste oben.
        -->
        <UButton
          type="submit"
          :loading="busy.active.value"
          :disabled="busy.active.value || props.locked"
          data-testid="form-submit"
        >
          {{ props.submitLabel }}
        </UButton>
      </div>
    </form>
  </UContainer>
</template>
