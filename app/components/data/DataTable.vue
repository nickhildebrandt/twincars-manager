<script setup lang="ts" generic="T extends { id: string }">
/**
 * Die Tabelle, die jede Liste benutzt.
 *
 * Drei Dinge, die sie festschreibt:
 *
 *   - **Die ganze Zeile ist anklickbar** und führt zur Detailansicht. Eine
 *     Tabelle, bei der man den einen unterstrichenen Text treffen muss, ist auf
 *     einem Werkstatt-Tablet unbedienbar.
 *   - **Aktionen in der Zeile schlucken den Klick**, sonst öffnet jeder Druck
 *     auf „Löschen" nebenbei die Detailseite.
 *   - **Auf schmalen Geräten wird aus jeder Zeile eine Karte.** Eine Tabelle
 *     mit acht Spalten auf einem Telefon ist keine Tabelle.
 *
 * Die Spalten werden hier beschrieben, nicht als Nuxt-UI-Definition
 * durchgereicht: so bleibt der Aufruf lesbar und die Darstellung an einer
 * Stelle.
 */
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

const cell = (row: T, column: Column<T>): string => {
  const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key]
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw)
}

const ariaSort = (column: Column<T>) => {
  if (!column.sortable || props.sort !== column.key) return undefined
  return props.dir === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div>
    <!-- Breite Geräte: eine echte Tabelle. -->
    <div
      class="hidden overflow-x-auto md:block"
      data-testid="data-table"
    >
      <table class="w-full border-collapse text-sm">
        <caption
          v-if="props.caption"
          class="sr-only"
        >
          {{ props.caption }}
        </caption>
        <thead>
          <tr class="border-b border-default text-left">
            <th
              v-for="column in props.columns"
              :key="column.key"
              scope="col"
              :aria-sort="ariaSort(column)"
              class="px-3 py-2 font-medium text-muted"
              :class="column.numeric && 'text-right'"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1 hover:text-default"
                :data-testid="`sort-${column.key}`"
                @click="emit('sort', column.key)"
              >
                {{ column.label }}
                <UIcon
                  v-if="props.sort === column.key"
                  :name="props.dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                  class="size-3"
                />
              </button>
              <template v-else>
                {{ column.label }}
              </template>
            </th>
            <th
              v-if="$slots.actions"
              scope="col"
              class="px-3 py-2"
            >
              <span class="sr-only">Aktionen</span>
            </th>
          </tr>
        </thead>

        <tbody :aria-busy="props.loading">
          <tr
            v-for="row in props.rows"
            :key="row.id"
            class="border-b border-default/60 transition-colors hover:bg-elevated/60"
            :class="props.to && 'cursor-pointer'"
            :data-testid="`row-${row.id}`"
            @click="props.to && navigateTo(props.to(row))"
          >
            <td
              v-for="column in props.columns"
              :key="column.key"
              class="px-3 py-2"
              :class="[column.numeric && 'text-right tabular-nums']"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
              >
                {{ cell(row, column) }}
              </slot>
            </td>

            <!-- Aktionen schlucken den Klick, sonst öffnet sich die Detailseite. -->
            <td
              v-if="$slots.actions"
              class="px-3 py-2 text-right"
              @click.stop
            >
              <slot
                name="actions"
                :row="row"
              />
            </td>
          </tr>
        </tbody>

        <tfoot v-if="props.totals">
          <tr class="border-t-2 border-default font-medium">
            <td
              v-for="column in props.columns"
              :key="column.key"
              class="px-3 py-2"
              :class="column.numeric && 'text-right tabular-nums'"
            >
              {{ props.totals[column.key] ?? '' }}
            </td>
            <td v-if="$slots.actions" />
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Schmale Geräte: je Zeile eine Karte. -->
    <ul
      class="flex flex-col gap-2 md:hidden"
      data-testid="data-cards"
    >
      <li
        v-for="row in props.rows"
        :key="row.id"
        class="rounded-md border border-default bg-default p-3"
        :data-testid="`card-${row.id}`"
      >
        <component
          :is="props.to ? 'button' : 'div'"
          class="flex w-full flex-col gap-1 text-left"
          @click="props.to && navigateTo(props.to(row))"
        >
          <span
            v-for="column in props.columns.filter(c => !c.secondary)"
            :key="column.key"
            class="flex justify-between gap-3"
          >
            <span class="text-xs text-muted">{{ column.label }}</span>
            <span :class="column.numeric && 'tabular-nums'">{{ cell(row, column) }}</span>
          </span>
        </component>

        <div
          v-if="$slots.actions"
          class="mt-2 flex justify-end gap-1 border-t border-default pt-2"
        >
          <slot
            name="actions"
            :row="row"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
