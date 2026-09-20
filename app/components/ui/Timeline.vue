<script setup lang="ts">
/**
 * Eine Historie als Zeitstrahl (M-02) — auf `UTimeline`.
 *
 * Wo es eine Historie gibt, wird sie grafisch gezeigt, nicht als Tabelle: beim
 * Fahrzeug die Halter- und Kennzeichenwechsel, beim Beleg der Statusverlauf,
 * bei Preisen und Löhnen der Verlauf, und seit M-45 die Stände jedes
 * versionierten Datensatzes.
 *
 * **Die Darstellung kommt vollständig von Nuxt UI.** Diese Datei hat genau
 * drei Aufgaben, und keine davon ist Gestaltung:
 *
 *   1. das Datum deutsch schreiben,
 *   2. „wer" in die Beschreibung ziehen,
 *   3. die Reihenfolge drehen, denn eine Historie liest man meist von hinten.
 *
 * Bis zum 20.09.2026 stand hier ein eigener Nachbau mit Punkten, Linien und
 * hundert Zeilen Tailwind. `UTimeline` kann all das — inklusive waagerechter
 * Ausrichtung, Größen und Auswahl, die der Nachbau nie hatte.
 */
import type { TimelineItem } from '@nuxt/ui'
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

const items = computed<TimelineItem[]>(() => {
  const ordered = [...props.entries].sort((a, b) =>
    props.newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))

  return ordered.map(entry => ({
    value: entry.id,
    date: formatDate(entry.date),
    title: entry.title,
    // „Anschrift geändert · Anna Schmitt" — beides gehört zusammen und passt
    // in eine Zeile, statt eine dritte aufzumachen.
    description: [entry.description, entry.actor].filter(Boolean).join(' · ') || undefined,
    icon: entry.icon ?? 'i-lucide-circle-dot',
  }))
})
</script>

<template>
  <div data-testid="timeline">
    <UEmpty
      v-if="items.length === 0"
      variant="naked"
      icon="i-lucide-history"
      :title="props.emptyText"
      data-testid="timeline-empty"
    />
    <UTimeline
      v-else
      :items="items"
      data-testid="timeline-list"
    />
  </div>
</template>
