<script setup lang="ts">
/**
 * Ein Verlauf über die Zeit (M-35).
 *
 * Bewusst einfach: eine Linie, eine Fläche darunter, ein hervorgehobener
 * letzter Punkt, eine Achse mit runden Beschriftungen. Keine Bibliothek — das
 * hier ist eine Handvoll Koordinaten, und ein Diagrammpaket brächte
 * Farbwelten mit, die nicht zur Anwendung gehören.
 *
 * Alle Werte kommen **gerechnet** herein und werden nirgends zwischengespeichert
 * (P-09). Die Rechnung selbst steht in `shared/chart.ts` und ist dort geprüft.
 */
import { formatDate } from '#shared/datetime'
import { pathPoints, scaleFor } from '#shared/chart'
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

const WIDTH = 640
const PADDING = 28

const scale = computed(() => scaleFor(props.points.map(point => point.value)))

const coordinates = computed(() => pathPoints(props.points, scale.value, {
  width: WIDTH,
  height: props.height,
  padding: PADDING,
}))

const line = computed(() =>
  coordinates.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '))

/** Die Fläche schließt unten an der Nulllinie, nicht am Bildrand. */
const area = computed(() => {
  if (coordinates.value.length === 0) return ''
  const base = props.height - PADDING
  const first = coordinates.value[0]!
  const last = coordinates.value.at(-1)!
  return `${line.value} L ${last.x} ${base} L ${first.x} ${base} Z`
})

const tickY = (value: number) => {
  const span = scale.value.max - scale.value.min
  const inner = props.height - PADDING * 2
  if (span === 0) return PADDING + inner / 2
  return PADDING + inner * (1 - (value - scale.value.min) / span)
}

const last = computed(() => coordinates.value.at(-1))
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

    <p
      v-if="props.points.length === 0"
      class="rounded-md bg-elevated px-3 py-8 text-center text-sm text-muted"
      data-testid="trend-empty"
    >
      {{ props.emptyText }}
    </p>

    <div
      v-else
      class="overflow-x-auto"
    >
      <svg
        :viewBox="`0 0 ${WIDTH} ${props.height}`"
        :style="{ height: `${props.height}px` }"
        class="w-full min-w-[320px]"
        role="img"
        :aria-label="`${props.label}: ${props.points.length} Werte von ${formatDate(props.points[0]!.at)} bis ${formatDate(props.points.at(-1)!.at)}`"
      >
        <!-- Raster und Achsenbeschriftung. -->
        <g>
          <template
            v-for="tick in scale.ticks"
            :key="tick"
          >
            <line
              :x1="PADDING"
              :x2="WIDTH - PADDING"
              :y1="tickY(tick)"
              :y2="tickY(tick)"
              stroke="currentColor"
              stroke-width="1"
              class="text-default"
              :opacity="tick === 0 ? 0.5 : 0.18"
            />
            <text
              :x="4"
              :y="tickY(tick) + 4"
              font-size="10"
              fill="currentColor"
              class="text-muted tabular-nums"
            >
              {{ props.format(tick) }}
            </text>
          </template>
        </g>

        <path
          :d="area"
          fill="currentColor"
          class="text-primary"
          opacity="0.12"
        />
        <path
          :d="line"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          class="text-primary"
        />

        <circle
          v-if="last"
          :cx="last.x"
          :cy="last.y"
          r="4"
          fill="currentColor"
          class="text-primary"
        />
      </svg>
    </div>

    <!-- Dieselben Zahlen als Text. Ein Diagramm allein ist keine Auskunft. -->
    <table class="sr-only">
      <caption>{{ props.label }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Zeitpunkt
          </th><th scope="col">
            Wert
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="point in props.points"
          :key="point.at"
        >
          <td>{{ formatDate(point.at) }}</td>
          <td>{{ props.format(point.value) }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
