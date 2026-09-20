<script setup lang="ts">
/**
 * Eine Historie als Zeitstrahl (M-02).
 *
 * Wo es eine Historie gibt, wird sie grafisch gezeigt, nicht als Tabelle: beim
 * Fahrzeug die Halter- und Kennzeichenwechsel, beim Beleg der Statusverlauf,
 * beim Auftrag die Tafel, bei Preisen und Löhnen der Verlauf.
 *
 * Eine Tabelle beantwortet „was stand wann drin", ein Zeitstrahl beantwortet
 * „was ist passiert" — und das ist die Frage, die jemand stellt, der eine
 * Historie öffnet.
 *
 * Die Einträge kommen fertig herein. Diese Komponente rechnet nichts aus und
 * lädt nichts nach; sie stellt dar.
 */
import { formatDate } from '#shared/datetime'

export type TimelineEntry = {
  id: string
  /** Der Tag, an dem es passierte, als `YYYY-MM-DD`. */
  date: string
  /** Was passiert ist, in einem kurzen deutschen Satz. */
  title: string
  /** Die Einzelheiten darunter — etwa „Ulm → Neu-Ulm". */
  description?: string
  /** Wer es getan hat. Leer, wenn es niemand war. */
  actor?: string
  /** Farbe des Punkts. Für das, was hervorstechen soll. */
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error'
  icon?: string
}

const props = withDefaults(defineProps<{
  entries: TimelineEntry[]
  /** Neueste zuerst. Für einen Preisverlauf ist die andere Richtung richtig. */
  newestFirst?: boolean
  emptyText?: string
}>(), {
  newestFirst: true,
  emptyText: 'Bisher ist nichts passiert.',
})

const TONE_CLASS = {
  neutral: 'bg-elevated ring-default',
  primary: 'bg-primary/15 ring-primary/40',
  success: 'bg-success/15 ring-success/40',
  warning: 'bg-warning/15 ring-warning/40',
  error: 'bg-error/15 ring-error/40',
} as const

const ordered = computed(() => {
  const sorted = [...props.entries].sort((a, b) => a.date.localeCompare(b.date))
  return props.newestFirst ? sorted.reverse() : sorted
})
</script>

<template>
  <div data-testid="timeline">
    <p
      v-if="ordered.length === 0"
      class="px-3 py-6 text-sm text-muted"
      data-testid="timeline-empty"
    >
      {{ props.emptyText }}
    </p>

    <ol
      v-else
      class="flex flex-col"
    >
      <li
        v-for="(entry, index) in ordered"
        :key="entry.id"
        class="flex gap-3"
        :data-testid="`timeline-entry-${entry.id}`"
      >
        <!-- Punkt und Linie. Die Linie endet beim letzten Eintrag. -->
        <div class="flex flex-col items-center">
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-full ring-1"
            :class="TONE_CLASS[entry.tone ?? 'neutral']"
          >
            <UIcon
              :name="entry.icon ?? 'i-lucide-circle-dot'"
              class="size-3.5"
            />
          </span>
          <span
            v-if="index < ordered.length - 1"
            class="w-px grow bg-default"
            aria-hidden="true"
          />
        </div>

        <div class="flex flex-col gap-0.5 pb-5">
          <time
            :datetime="entry.date"
            class="text-xs text-muted tabular-nums"
          >
            {{ formatDate(entry.date) }}
          </time>
          <p class="font-medium">
            {{ entry.title }}
          </p>
          <p
            v-if="entry.description"
            class="text-sm text-toned"
          >
            {{ entry.description }}
          </p>
          <p
            v-if="entry.actor"
            class="text-xs text-dimmed"
          >
            {{ entry.actor }}
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>
