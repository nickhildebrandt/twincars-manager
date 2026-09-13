<script setup lang="ts">
/**
 * Dateien ablegen oder auswählen.
 *
 * Zwei Dinge, die der Vorgänger falsch hatte:
 *
 *   - **Die erlaubten Arten sind an einer Stelle festgelegt** und gelten für
 *     den Dialog wie für das Ablegen. Dort prüfte das Ablegen nur auf
 *     „irgendein Bild" und ließ damit Formate durch, die der Dialog gar nicht
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
const input = useTemplateRef<HTMLInputElement>('input')
const over = ref(false)

const acceptAttribute = computed(() => props.accept?.join(',') || undefined)

/** Prüft jede Datei und meldet, was nicht durchgeht — statt still zu schlucken. */
function take(files: FileList | null): void {
  if (!files || files.length === 0) return

  const accepted: File[] = []
  for (const file of Array.from(files)) {
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

  if (accepted.length > 0) emit('files', props.multiple ? accepted : accepted.slice(0, 1))
}

function onDrop(event: DragEvent): void {
  over.value = false
  if (props.disabled) return
  take(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors"
    :class="[
      over ? 'border-primary bg-primary/5' : 'border-default',
      props.disabled && 'opacity-60',
    ]"
    data-testid="dropzone"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="onDrop"
  >
    <UIcon
      name="i-lucide-upload"
      class="size-6 text-dimmed"
    />
    <p class="text-sm text-muted">
      {{ props.label }}
    </p>

    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      :disabled="props.disabled"
      data-testid="dropzone-browse"
      @click="input?.click()"
    >
      Auswählen
    </UButton>

    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="acceptAttribute"
      :multiple="props.multiple"
      :disabled="props.disabled"
      data-testid="dropzone-input"
      @change="take(($event.target as HTMLInputElement).files)"
    >
  </div>
</template>
