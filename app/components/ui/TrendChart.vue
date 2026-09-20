<script setup lang="ts">
/**
 * Ein Verlauf über die Zeit (M-35) — auf **Chart.js**.
 *
 * Alle Werte kommen **gerechnet** herein und werden nirgends
 * zwischengespeichert (P-09). Diese Komponente stellt nur dar.
 *
 * **Chart.js ohne Vue-Hülle.** `vue-chartjs` wäre der bequeme Weg und hat
 * genau einen Betreuer — dieselbe Abhängigkeit von einem einzelnen Menschen,
 * wegen der `nuxt-charts` ausgeschieden ist. Chart.js selbst hat fünf
 * Betreuer und **eine** Abhängigkeit. Es direkt anzusprechen kostet die
 * dreißig Zeilen unten und spart die Hülle; mehr als ein `<canvas>`, ein
 * `onMounted` und ein `watch` ist es nicht.
 *
 * **Nur im Browser.** Ein `<canvas>` lässt sich auf dem Server nicht
 * zeichnen. Die Komponente wird deshalb clientseitig aufgebaut; bis dahin
 * steht die Fläche mit ihrer endgültigen Höhe da, damit die Seite nicht
 * springt.
 *
 * Eigen bleibt sonst nur, was **Fachlichkeit** ist: die deutsche
 * Beschriftung, das Format der Werte (meist Euro aus Cent) und der
 * Leerzustand. Ein Diagramm ohne Daten zeigt keine leere Achse, sondern einen
 * Satz.
 */
import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { ChartConfiguration } from 'chart.js'
import { formatDate } from '#shared/datetime'
import type { Point } from '#shared/chart'

/**
 * Nur die Teile, die gebraucht werden.
 *
 * Chart.js bringt Balken, Torten, Radar und Blasen mit. Wer `Chart.register(
 * ...registerables)` schreibt, nimmt alles ins Bündel — hier stehen genau die
 * sieben Bausteine einer Linie mit Fläche.
 */
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
)

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

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let chart: Chart | undefined

/** Wovon das Diagramm handelt — als Satz, für Beschriftung und Tabelle. */
const description = computed(() => props.points.length === 0
  ? props.label
  : `${props.label}: ${props.points.length} Werte von `
    + `${formatDate(props.points[0]!.at)} bis ${formatDate(props.points.at(-1)!.at)}`)

/**
 * Die Farbe der Linie.
 *
 * Aus dem Designsystem gelesen, nicht danebengeschrieben: so folgt das
 * Diagramm dem Farbschema und dem hellen wie dem dunklen Modus, ohne dass
 * hier ein zweiter Farbwert gepflegt werden muss.
 */
function accent(): string {
  if (!import.meta.client) return '#3b82f6'
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--ui-primary').trim()
  return value || '#3b82f6'
}

function configuration(): ChartConfiguration<'line'> {
  const colour = accent()

  return {
    type: 'line',
    data: {
      labels: props.points.map(point => formatDate(point.at)),
      datasets: [{
        label: props.label,
        data: props.points.map(point => point.value),
        borderColor: colour,
        backgroundColor: `color-mix(in oklab, ${colour} 18%, transparent)`,
        fill: true,
        tension: 0.25,
        pointRadius: props.points.length > 24 ? 0 : 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Das Diagramm ist ein Bild; die Auskunft steht in der Tabelle daneben.
      // Eine Legende mit einem einzigen Eintrag sagt nichts.
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // `parsed.y` ist bei einer Lücke in der Reihe `null`. Dann steht
            // dort ein Gedankenstrich und nicht „0,00 €" — eine erfundene
            // Null ist schlimmer als ein sichtbares Loch.
            label: item => item.parsed.y === null ? '—' : props.format(item.parsed.y),
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          // Nicht bei null anfangen zu müssen: ein Kassenbestand kann ins
          // Minus gehen, und ein Umsatzverlauf um 100 000 herum wäre sonst
          // eine flache Linie am oberen Rand.
          beginAtZero: false,
          ticks: { callback: value => props.format(Number(value)) },
        },
      },
      animation: prefersReducedMotion() ? false : undefined,
    },
  }
}

/** Wer weniger Bewegung möchte, bekommt keine. */
function prefersReducedMotion(): boolean {
  return import.meta.client
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function draw(): void {
  if (!canvas.value || props.points.length === 0) return
  chart?.destroy()
  chart = new Chart(canvas.value, configuration())
}

onMounted(draw)

// Neue Zahlen, neues Bild. Chart.js kann auch einzelne Werte nachziehen, aber
// die Punkte kommen hier immer als vollständige Reihe — ein Neuzeichnen ist
// ehrlicher als ein halb gepflegter Zustand.
watch(() => props.points, draw, { deep: true })

// Ohne das bleibt der Zeichenkontext am Leben, und bei jedem Seitenwechsel
// kommt einer dazu.
onBeforeUnmount(() => {
  chart?.destroy()
  chart = undefined
})
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
        :style="{ height: `${props.height}px` }"
        role="img"
        :aria-label="description"
        data-testid="trend-plot"
      >
        <canvas ref="canvas" />
      </div>

      <!--
        Dieselben Zahlen als Tabelle, nur für Screenreader.

        Bei einem `<canvas>` ist das keine Höflichkeit, sondern die einzige
        Auskunft: die Zeichenfläche hat keinen Inhalt, den ein Screenreader
        vorlesen könnte. `role="img"` sagt, **worum** es geht; was darin
        steht, sagt allein diese Tabelle.
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
