<script setup lang="ts">
/**
 * Ein Verlauf über die Zeit (M-35) — auf `nuxt-charts`.
 *
 * Alle Werte kommen **gerechnet** herein und werden nirgends
 * zwischengespeichert (P-09). Diese Komponente stellt nur dar.
 *
 * Bis zum 20.09.2026 stand hier ein eigenes SVG mit Pfaden, Rastern und
 * Achsenbeschriftung. Entschieden am 20.09.2026: Diagramme kommen aus
 * `nuxt-charts` (E-25) — ein Nuxt-Modul, dessen Komponenten auto-importiert
 * werden und dessen Beispiele Nuxt UI daneben benutzen.
 *
 * Eigen bleibt hier nur, was **Fachlichkeit** ist: die deutsche Beschriftung,
 * das Format der Werte (meist Euro aus Cent) und der Leerzustand. Ein
 * Diagramm ohne Daten zeigt keine leere Achse, sondern einen Satz.
 */
import { formatDate } from '#shared/datetime'
import type { Point } from '#shared/chart'

const props = withDefaults(defineProps<{
  points: Point[]
  /** Wie ein Wert geschrieben wird — meist `formatEuro`. */
  format?: (value: number) => string
  /** Was gezeigt wird, für Screenreader und die Beschriftung. */
  label: string
  height?: number
  emptyText?: string
}>(), {
  height: 180,
  format: (value: number) => String(value),
  emptyText: 'Für diesen Zeitraum gibt es nichts zu zeigen.',
})

/** `nuxt-charts` erwartet eine Zeile je Punkt mit benannten Feldern. */
const data = computed(() => props.points.map(point => ({ value: point.value })))

const categories = computed(() => ({
  value: { name: props.label, color: 'var(--ui-primary)' },
}))

/** Wovon das Diagramm handelt — als Satz, für Beschriftung und Tabelle. */
const description = computed(() => props.points.length === 0
  ? props.label
  : `${props.label}: ${props.points.length} Werte von `
    + `${formatDate(props.points[0]!.at)} bis ${formatDate(props.points.at(-1)!.at)}`)

/** Die Achse zeigt das Datum, nicht den Index. */
const xFormatter = (index: number): string => {
  const point = props.points[index]
  return point ? formatDate(point.at) : ''
}
</script>

<template>
  <figure
    class="m-0 flex flex-col gap-2"
    data-testid="trend-chart"
  >
    <figcaption class="flex items-baseline justify-between gap-2">
      <span class="text-sm font-medium">{{ props.label }}</span>
      <span
        v-if="props.points.length > 0"
        class="text-sm text-muted tabular-nums"
        data-testid="trend-latest"
      >
        {{ props.format(props.points.at(-1)!.value) }}
      </span>
    </figcaption>

    <UEmpty
      v-if="props.points.length === 0"
      variant="naked"
      icon="i-lucide-chart-line"
      :title="props.emptyText"
      data-testid="trend-empty"
    />

    <template v-else>
      <div
        role="img"
        :aria-label="description"
        data-testid="trend-plot"
      >
        <AreaChart
          :data="data"
          :categories="categories"
          :height="props.height"
          :x-formatter="xFormatter"
          :y-formatter="props.format"
          :hide-legend="true"
        />
      </div>

      <!--
        Dieselben Zahlen als Tabelle, nur für Screenreader.

        Ein Diagramm ist ein Bild; `role="img"` mit einer Beschriftung sagt,
        **worum** es geht, aber nicht, **was darin steht**. Wer nicht sehen
        kann, bekommt hier die Werte — dieselben, aus derselben Quelle, nicht
        eine zweite Rechnung. Das ist kein Eingriff in `nuxt-charts`, sondern
        eine Ergänzung daneben (Regel 4, Ausnahme für Zugänglichkeit).
      -->
      <table
        class="sr-only"
        data-testid="trend-table"
      >
        <caption>{{ description }}</caption>
        <thead>
          <tr>
            <th scope="col">
              Zeitpunkt
            </th>
            <th scope="col">
              {{ props.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="point in props.points"
            :key="point.at"
          >
            <th scope="row">
              {{ formatDate(point.at) }}
            </th>
            <td>{{ props.format(point.value) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </figure>
</template>
