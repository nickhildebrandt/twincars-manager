<script setup lang="ts" generic="T extends { id: string }">
/**
 * Die Tabelle, die jede Liste benutzt — auf `UTable`.
 *
 * **Die Tabelle selbst gehört Nuxt UI.** Bis zum 20.09.2026 stand hier ein
 * von Hand geschriebenes `<table>` mit eigenen `<thead>`, `<tbody>`,
 * Sortierknöpfen und Zeilenklick. `UTable` kann das alles — und drei Dinge
 * zusätzlich, die der Nachbau nicht hatte:
 *
 *   - Eine anklickbare Zeile bekommt `role="button"` und `tabindex`, ist also
 *     **mit der Tastatur erreichbar**. Ein `<tr @click>` ist das nicht.
 *   - Der Ladezustand hat eine Animation, die bei `prefers-reduced-motion`
 *     **von selbst** zu einem ruhigen Puls wird.
 *   - Ausgewählte Zeilen bekommen einen Fokusrahmen, den ich vergessen hatte.
 *
 * Was hier bleibt, ist kein Aussehen, sondern **Vereinbarung**:
 *
 *   - **Die Spalten werden beschrieben, nicht als Tabellendefinition
 *     durchgereicht.** Eine Liste aus `{ key, label, numeric }` ist an der
 *     Aufrufstelle lesbar; die Übersetzung in das, was `UTable` erwartet,
 *     steht einmal hier statt zwanzigmal in den Fachpaketen.
 *   - **Die ganze Zeile führt zur Detailansicht.** Eine Tabelle, bei der man
 *     den einen unterstrichenen Text treffen muss, ist auf einem
 *     Werkstatt-Tablet unbedienbar.
 *   - **Aktionen in der Zeile schlucken den Klick**, sonst öffnet jeder Druck
 *     auf „Löschen" nebenbei die Detailseite.
 *   - **Auf schmalen Geräten wird aus jeder Zeile eine Karte.** Eine Tabelle
 *     mit acht Spalten auf einem Telefon ist keine Tabelle. Dafür hat Nuxt UI
 *     nichts; das ist die einzige Stelle, an der hier noch Markup steht.
 */
import type { TableColumn } from '@nuxt/ui'

export type Column<Row> = {
  key: string
  label: string
  /** Was in der Zelle steht. Ohne Angabe der Wert unter `key`. */
  value?: (row: Row) => string | number | null | undefined
  /** Rechtsbündig — für alles, was gerechnet wird. */
  numeric?: boolean
  /** Nach dieser Spalte lässt sich sortieren. Der Name geht an den Server. */
  sortable?: boolean
  /** Auf schmalen Geräten weglassen. */
  secondary?: boolean
}

const props = withDefaults(defineProps<{
  rows: T[]
  columns: Column<T>[]
  /** Wohin ein Klick auf die Zeile führt. Ohne Angabe ist nichts anklickbar. */
  to?: (row: T) => string
  /** Spalte und Richtung, wie sie gerade gelten. */
  sort?: string
  dir?: 'asc' | 'desc'
  /** Eine Summenzeile am Fuß. */
  totals?: Record<string, string>
  loading?: boolean
  caption?: string
}>(), {
  loading: false,
})

const emit = defineEmits<{ sort: [column: string] }>()

/** Der angezeigte Wert einer Zelle. Leer wird zum Gedankenstrich, nie zu „null". */
const cell = (row: T, column: Column<T>): string => {
  const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw)
}

/**
 * Die Spaltenbeschreibung, übersetzt für `UTable`.
 *
 * `meta.class` richtet Zahlenspalten rechtsbündig aus und stellt sie auf
 * Tabellenziffern — sonst tanzen die Stellen untereinander.
 */
const tableColumns = computed<TableColumn<T>[]>(() => {
  const list: TableColumn<T>[] = props.columns.map(column => ({
    id: column.key,
    accessorKey: column.key,
    header: column.label,
    // `UTable` zeigt den Fuß, sobald eine Spalte den Schlüssel `footer`
    // **besitzt** — `undefined` zählt bereits. Ohne Summen darf er deshalb
    // gar nicht erst gesetzt werden; eine leere Fußzeile unter jeder Liste
    // wäre Lärm.
    ...(props.totals ? { footer: '' } : {}),
    meta: column.numeric
      ? { class: { th: 'text-right', td: 'text-right tabular-nums' } }
      : undefined,
  }))

  if (slots.actions) {
    list.push({ id: '__actions', header: '', meta: { class: { td: 'text-right w-0' } } })
  }

  return list
})

const slots = defineSlots<{
  actions?: (props: { row: T }) => unknown
} & Record<string, (props: { row: T }) => unknown>>()

/** Die Spalten, die auf einem Telefon gezeigt werden. */
const primaryColumns = computed(() => props.columns.filter(column => !column.secondary))

/**
 * Wie der Sortierknopf einem Screenreader heißt.
 *
 * `aria-sort` gehört an das `<th>`, und dorthin lässt `UTable` keine eigenen
 * Attribute. Das ist kein Grund, am Fremdpaket vorbeizubauen: die Sortierung
 * darf ebenso gut über den **zugänglichen Namen des Knopfes** angesagt
 * werden, und der Knopf ist genau das Element, das man drückt, um sie zu
 * ändern.
 */
const sortLabel = (column: Column<T>): string => {
  if (props.sort !== column.key) return `Nach ${column.label} sortieren`
  return props.dir === 'asc'
    ? `${column.label}, aufsteigend sortiert. Klicken für absteigend.`
    : `${column.label}, absteigend sortiert. Klicken für aufsteigend.`
}

function open(row: T): void {
  if (props.to) navigateTo(props.to(row))
}

/**
 * Der Zeilenklick — als Wert, nicht als Ausdruck im Template.
 *
 * `@select="bedingung ? fn : undefined"` sieht richtig aus und ist es nicht:
 * Vue macht daraus einen Aufrufer, der **immer** existiert. `UTable` hielte
 * jede Zeile für auswählbar, und geöffnet würde trotzdem nichts.
 */
const onSelect = computed(() => props.to
  ? (_event: Event, row: { original: T }) => open(row.original)
  : undefined)
</script>

<template>
  <div>
    <!-- Breite Geräte: die Tabelle von Nuxt UI. -->
    <!--
      `aria-busy` steht hier und nicht an der Tabelle: `UTable` zeigt das Laden
      **nur sichtbar**, über einen Balken in der Kopfzeile, und sagt einem
      Screenreader nichts davon. Das ist eine echte Lücke, und sie wird an
      einem eigenen Element geschlossen, statt am Fremdpaket vorbeizubauen.
    -->
    <div
      class="hidden md:block"
      data-testid="data-table"
      :aria-busy="props.loading || undefined"
    >
      <UTable
        :data="props.rows"
        :columns="tableColumns"
        :loading="props.loading"
        :caption="props.caption"
        :on-select="onSelect"
      >
        <!-- Sortierbare Überschriften: ein Knopf, der den Namen nach oben gibt. -->
        <template
          v-for="column in props.columns.filter(c => c.sortable)"
          :key="`${column.key}-header`"
          #[`${column.key}-header`]
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :label="column.label"
            :trailing-icon="props.sort === column.key
              ? (props.dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down')
              : undefined"
            :aria-label="sortLabel(column)"
            :data-testid="`sort-${column.key}`"
            @click="emit('sort', column.key)"
          />
        </template>

        <!-- Zellen: eigener Inhalt, wenn die Seite einen mitbringt. -->
        <template
          v-for="column in props.columns"
          :key="`${column.key}-cell`"
          #[`${column.key}-cell`]="{ row }"
        >
          <slot
            :name="`cell-${column.key}`"
            :row="(row.original as T)"
          >
            {{ cell(row.original as T, column) }}
          </slot>
        </template>

        <!-- Aktionen schlucken den Klick, sonst öffnet sich die Detailseite. -->
        <template
          v-if="slots.actions"
          #__actions-cell="{ row }"
        >
          <div @click.stop>
            <slot
              name="actions"
              :row="(row.original as T)"
            />
          </div>
        </template>

        <!-- Summenzeile: je Spalte ein Fuß. -->
        <template
          v-for="column in (props.totals ? props.columns : [])"
          :key="`${column.key}-footer`"
          #[`${column.key}-footer`]
        >
          <span :class="column.numeric && 'tabular-nums'">
            {{ props.totals?.[column.key] ?? '' }}
          </span>
        </template>
      </UTable>
    </div>

    <!-- Schmale Geräte: je Zeile eine Karte. Dafür hat Nuxt UI nichts. -->
    <ul
      class="flex flex-col gap-2 md:hidden"
      data-testid="data-cards"
    >
      <li
        v-for="row in props.rows"
        :key="row.id"
        :data-testid="`card-${row.id}`"
      >
        <UCard :ui="{ body: 'p-3 sm:p-3' }">
          <component
            :is="props.to ? 'button' : 'div'"
            class="flex w-full flex-col gap-1 text-left"
            @click="open(row)"
          >
            <span
              v-for="column in primaryColumns"
              :key="column.key"
              class="flex justify-between gap-3"
            >
              <span class="text-xs text-muted">{{ column.label }}</span>
              <span :class="column.numeric && 'tabular-nums'">{{ cell(row, column) }}</span>
            </span>
          </component>

          <template
            v-if="slots.actions"
            #footer
          >
            <div class="flex justify-end gap-1">
              <slot
                name="actions"
                :row="row"
              />
            </div>
          </template>
        </UCard>
      </li>
    </ul>
  </div>
</template>
