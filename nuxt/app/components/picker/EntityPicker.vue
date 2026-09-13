<script setup lang="ts">
/**
 * Einen Datensatz auswählen — immer im modalen Dialog, immer mit Serversuche.
 *
 * Nie ein `<select>` für eine Beziehung: bei zweitausend Kunden ist eine
 * Auswahlliste keine Auswahl. Und nie im Browser filtern — gesucht wird dort,
 * wo die Daten liegen.
 *
 * Vier Dinge, die der Vorgänger nicht hatte:
 *
 *   - **Antworten kommen in der richtigen Reihenfolge an.** Eine langsame
 *     ältere Antwort überschrieb die neuere, und die Liste passte nicht zur
 *     Eingabe (B-109).
 *   - **Ein Fehler wird gezeigt.** Ohne Behandlung endete ein 403 als leerer
 *     Dialog ohne Erklärung (B-113).
 *   - **Das Suchfeld hat einen Namen**, nicht nur einen Platzhalter (B-093).
 *   - **Der Auslöser trägt seinen eigenen Namen.** In ein Formularfeld
 *     gewickelt las ein Screenreader sonst Feldbeschriftung und Dialogtext
 *     zusammen (B-096).
 */
import type { PickerOption } from '#shared/picker-labels'
import type { ListResult } from '#shared/schemas/pagination'
import { SEARCH_DEBOUNCE_MS } from '~/composables/useListQuery'

const selected = defineModel<string | null>({ default: null })

const props = withDefaults(defineProps<{
  /** Der Endpoint, z. B. `/api/pickers/customers`. */
  path: string
  /** Was ausgewählt wird, im Singular: „Kunde", „Fahrzeug". */
  entity: string
  /** Die Beschriftung des bereits Ausgewählten. */
  display?: string | null
  /** Zusätzliche Parameter, etwa ein Kunde zum Einschränken der Fahrzeuge. */
  params?: Record<string, string | undefined>
  disabled?: boolean
  /** Wenn gesetzt, erscheint „Neu anlegen" — genau eine solche Schaltfläche. */
  onCreate?: () => void
}>(), {
  disabled: false,
})

const api = useApi()

const open = ref(false)
const search = ref('')
const page = ref(1)
const result = ref<ListResult<PickerOption> | null>(null)
const loading = ref(false)
const failed = ref(false)

const searchId = useId()

/** Nur die jüngste Anfrage darf schreiben (B-109). */
let generation = 0
let debounce: ReturnType<typeof setTimeout> | undefined

async function load(): Promise<void> {
  const mine = ++generation
  loading.value = true
  failed.value = false
  try {
    const loaded = await api.get<ListResult<PickerOption>>(props.path, {
      query: { q: search.value || undefined, page: page.value, ...props.params },
    })
    if (mine !== generation) return
    result.value = loaded
  }
  catch {
    // `useApi` hat den deutschen Satz schon gezeigt. Hier bleibt, den Dialog
    // nicht schweigend leer zu lassen.
    if (mine === generation) failed.value = true
  }
  finally {
    if (mine === generation) loading.value = false
  }
}

watch(search, () => {
  page.value = 1
  if (debounce !== undefined) clearTimeout(debounce)
  debounce = setTimeout(() => void load(), SEARCH_DEBOUNCE_MS)
})

watch(page, () => void load())

watch(open, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  page.value = 1
  void load()
})

onScopeDispose(() => {
  if (debounce !== undefined) clearTimeout(debounce)
})

function choose(option: PickerOption): void {
  selected.value = option.id
  open.value = false
}

function clear(): void {
  selected.value = null
}

const label = computed(() => props.display?.trim() || `${props.entity} wählen`)
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      color="neutral"
      variant="outline"
      class="min-w-0 grow justify-start"
      :disabled="props.disabled"
      icon="i-lucide-search"
      :aria-label="props.display ? `${props.entity}: ${props.display}. Ändern` : `${props.entity} wählen`"
      :data-testid="`picker-${props.entity.toLowerCase()}`"
      @click="open = true"
    >
      <span
        class="truncate"
        :class="!props.display && 'text-dimmed'"
      >{{ label }}</span>
    </UButton>

    <UButton
      v-if="selected && !props.disabled"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      :aria-label="`${props.entity} entfernen`"
      data-testid="picker-clear"
      @click="clear"
    />

    <UModal
      v-model:open="open"
      :title="`${props.entity} wählen`"
      description="Suchen Sie und wählen Sie einen Eintrag aus der Liste."
      data-testid="picker-dialog"
    >
      <!--
        `#actions`, nicht `#header`: der Kopfbereich enthält den Titel, den
        Reka UI als `DialogTitle` erzeugt und über `aria-labelledby`
        anspricht. Wird er überschrieben, zeigt die Beschriftung ins Leere und
        ein Screenreader sagt „Dialog" ohne zu sagen, welcher.
      -->
      <template #actions>
        <UButton
          v-if="props.onCreate"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          data-testid="picker-create"
          @click="open = false; props.onCreate()"
        >
          Neu anlegen
        </UButton>
      </template>

      <template #body>
        <div class="flex flex-col gap-3">
          <div>
            <label
              :for="searchId"
              class="sr-only"
            >{{ props.entity }} suchen</label>
            <UInput
              :id="searchId"
              v-model="search"
              type="search"
              icon="i-lucide-search"
              :placeholder="`${props.entity} suchen …`"
              autofocus
              class="w-full"
              data-testid="picker-search"
            />
          </div>

          <p
            v-if="failed"
            class="rounded-md bg-elevated px-3 py-6 text-center text-sm text-muted"
            data-testid="picker-error"
          >
            Die Suche ist fehlgeschlagen. Bitte versuchen Sie es erneut.
          </p>

          <p
            v-else-if="result && result.items.length === 0"
            class="px-3 py-6 text-center text-sm text-muted"
            data-testid="picker-empty"
          >
            Kein {{ props.entity }} gefunden.
          </p>

          <ul
            v-else
            class="flex max-h-80 flex-col gap-0.5 overflow-y-auto"
            :aria-busy="loading"
            data-testid="picker-results"
          >
            <li
              v-for="option in result?.items ?? []"
              :key="option.id"
            >
              <button
                type="button"
                class="flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors hover:bg-elevated"
                :class="option.id === selected && 'bg-elevated'"
                :data-testid="`picker-option-${option.id}`"
                @click="choose(option)"
              >
                <span class="font-medium">{{ option.label }}</span>
                <span
                  v-if="option.sublabel"
                  class="text-sm text-muted"
                >{{ option.sublabel }}</span>
              </button>
            </li>
          </ul>

          <UPagination
            v-if="result && result.pageCount > 1"
            :page="page"
            :items-per-page="result.size"
            :total="result.total"
            size="sm"
            data-testid="picker-pagination"
            @update:page="(to: number) => page = to"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
