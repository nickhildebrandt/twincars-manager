<script setup lang="ts">
/**
 * Dateien ablegen oder auswählen — auf `UFileUpload` (`variant="area"`).
 *
 * **Das Ablegen, die Vorschau und die Tastaturbedienung kommen von Nuxt UI.**
 * Bis zum 20.09.2026 stand hier ein eigener Nachbau mit `@dragover`,
 * verstecktem `<input type="file">` und einem Rahmen, der beim Darüberziehen
 * die Farbe wechselte. Das kann `UFileUpload` alles — und zusätzlich das, was
 * der Nachbau nie hatte: eine Dateiliste, das Entfernen einzelner Dateien und
 * eine ordentliche Beschriftung für Screenreader.
 *
 * Eigen bleibt nur die **Prüfung**, und die ist Fachlichkeit. Zwei Dinge, die
 * der Vorgänger falsch hatte:
 *
 *   - **Die erlaubten Arten sind an einer Stelle festgelegt** und gelten für
 *     den Dialog wie für das Ablegen. Dort prüfte das Ablegen nur auf
 *     „irgendein Bild" und ließ Formate durch, die der Dialog gar nicht
 *     anbot (B-115).
 *   - **Ein Fehler wird gemeldet.** Dort verschwand er in einem leeren
 *     `catch`, und wer eine zu große Datei ablegte, sah gar nichts (B-100).
 */
import { LIMITS, formatBytes, isAllowedUpload } from '#shared/schemas/upload'

const props = withDefaults(defineProps<{
  /** Erlaubte Medientypen. Leer heißt: was `shared/schemas/upload` erlaubt. */
  accept?: string[]
  multiple?: boolean
  disabled?: boolean
  label?: string
}>(), {
  multiple: false,
  disabled: false,
  label: 'Datei auswählen oder hierher ziehen',
})

const emit = defineEmits<{ files: [File[]] }>()

const notify = useNotify()

/** Was `UFileUpload` gerade hält. Geprüft wird beim Wechsel, nicht beim Senden. */
const selection = ref<File | File[] | null>(null)

const acceptAttribute = computed(() => props.accept?.join(',') || undefined)

/** Prüft jede Datei und meldet, was nicht durchgeht — statt still zu schlucken. */
function keep(files: File[]): File[] {
  const accepted: File[] = []

  for (const file of files) {
    if (props.accept && props.accept.length > 0 && !props.accept.includes(file.type)) {
      notify.error(`„${file.name}" hat ein Format, das hier nicht vorgesehen ist.`)
      continue
    }
    if (!isAllowedUpload(file.type)) {
      notify.error(`„${file.name}" hat ein Format, das nicht hochgeladen werden kann.`)
      continue
    }
    if (file.size > LIMITS.document.bytes) {
      notify.error(`„${file.name}" ist zu groß.`, {
        description: `Höchstens ${formatBytes(LIMITS.document.bytes)} je Datei.`,
      })
      continue
    }
    accepted.push(file)
  }

  return accepted
}

watch(selection, (value) => {
  const files = value === null ? [] : Array.isArray(value) ? value : [value]
  if (files.length === 0) return

  const accepted = keep(files)
  if (accepted.length > 0) emit('files', props.multiple ? accepted : accepted.slice(0, 1))
})
</script>

<template>
  <UFileUpload
    v-model="selection"
    variant="area"
    icon="i-lucide-upload"
    :label="props.label"
    :accept="acceptAttribute"
    :multiple="props.multiple"
    :disabled="props.disabled"
    data-testid="dropzone"
  />
</template>
