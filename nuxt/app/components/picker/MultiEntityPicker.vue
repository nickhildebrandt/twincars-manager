<script setup lang="ts">
/**
 * Mehrere Datensätze auswählen — im modalen Dialog, transaktional.
 *
 * **Transaktional** heißt: was im Dialog angehakt wird, gilt erst mit
 * „Übernehmen". Wer abbricht, ändert nichts. Ein Dialog, der jede Häkchen-
 * setzung sofort speichert, macht „Abbrechen" zur Lüge.
 *
 * Die Suche läuft auf dem Server, die Reihenfolge der Antworten ist
 * abgesichert — dieselben Gründe wie beim einfachen Picker.
 */
import type { PickerOption } from '#shared/picker-labels'
import type { ListResult } from '#shared/schemas/pagination'
import { SEARCH_DEBOUNCE_MS } from '~/composables/useListQuery'

const selected = defineModel<string[]>({ default: () => [] })

const props = withDefaults(defineProps<{
  path: string
  /** Im Plural: „Mitarbeiter", „Artikel". */
  entity: string
  /** Die Beschriftungen der bereits Ausgewählten, für die Anzeige. */
  display?: string[]
  params?: Record<string, string | undefined>
  disabled?: boolean
}>(), {
  display: () => [],
  disabled: false,
})

const api = useApi()

const open = ref(false)
const search = ref('')
const page = ref(1)
const result = ref<ListResult<PickerOption> | null>(null)
const loading = ref(false)
const failed = ref(false)

/** Der Zwischenstand im Dialog. Er wird erst beim Übernehmen übertragen. */
const draft = ref<string[]>([])

const searchId = useId()

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
  draft.value = [...selected.value]
  search.value = ''
  page.value = 1
  void load()
})
onScopeDispose(() => {
  if (debounce !== undefined) clearTimeout(debounce)
})

const isChecked = (id: string) => draft.value.includes(id)

function toggle(id: string): void {
  draft.value = isChecked(id)
    ? draft.value.filter(entry => entry !== id)
    : [...draft.value, id]
}

function apply(): void {
  selected.value = [...draft.value]
  open.value = false
}

const label = computed(() => {
  if (props.display.length === 0) return `${props.entity} wählen`
  if (props.display.length <= 2) return props.display.join(', ')
  return `${props.display.slice(0, 2).join(', ')} und ${props.display.length - 2} weitere`
})
</script>

<template>
  <div>
    <UButton
      color="neutral"
      variant="outline"
      class="w-full justify-start"
      :disabled="props.disabled"
      icon="i-lucide-users"
      :aria-label="`${props.entity} wählen, ${selected.length} ausgewählt`"
      :data-testid="`multi-picker-${props.entity.toLowerCase()}`"
      @click="open = true"
    >
      <span
        class="truncate"
        :class="props.display.length === 0 && 'text-dimmed'"
      >{{ label }}</span>
    </UButton>

    <UModal
      v-model:open="open"
      :title="`${props.entity} wählen`"
      description="Haken Sie an, was gelten soll. Übernommen wird alles auf einmal."
      data-testid="multi-picker-dialog"
    >
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
              data-testid="multi-picker-search"
            />
          </div>

          <p
            v-if="failed"
            class="rounded-md bg-elevated px-3 py-6 text-center text-sm text-muted"
            data-testid="multi-picker-error"
          >
            Die Suche ist fehlgeschlagen. Bitte versuchen Sie es erneut.
          </p>

          <ul
            v-else
            class="flex max-h-80 flex-col gap-0.5 overflow-y-auto"
            :aria-busy="loading"
            data-testid="multi-picker-results"
          >
            <li
              v-for="option in result?.items ?? []"
              :key="option.id"
            >
              <UCheckbox
                :model-value="isChecked(option.id)"
                :label="option.label"
                :description="option.sublabel"
                class="rounded-md px-3 py-2 hover:bg-elevated"
                :data-testid="`multi-picker-option-${option.id}`"
                @update:model-value="toggle(option.id)"
              />
            </li>
          </ul>

          <UPagination
            v-if="result && result.pageCount > 1"
            :page="page"
            :items-per-page="result.size"
            :total="result.total"
            size="sm"
            @update:page="(to: number) => page = to"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            data-testid="multi-picker-cancel"
            @click="open = false"
          >
            Abbrechen
          </UButton>
          <UButton
            data-testid="multi-picker-apply"
            @click="apply"
          >
            Übernehmen ({{ draft.length }})
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
