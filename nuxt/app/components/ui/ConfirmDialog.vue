<script setup lang="ts">
/**
 * Der eine Bestätigungsdialog.
 *
 * Geöffnet wird er über `useConfirm()`, nie direkt. Fokusfang, Escape und die
 * Rückgabe des Fokus kommen von Nuxt UI — genau deshalb gibt es keinen
 * zweiten, selbstgebauten Dialog mehr (B-108).
 */
const props = defineProps<{
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  tone: 'primary' | 'error'
  details: string[]
}>()

const emit = defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal
    :title="props.title"
    :description="props.description"
    :dismissible="true"
    data-testid="confirm-dialog"
    @update:open="(open: boolean) => !open && emit('close', false)"
  >
    <template #body>
      <p
        v-if="props.description"
        class="text-muted"
        data-testid="confirm-description"
      >
        {{ props.description }}
      </p>

      <ul
        v-if="props.details.length > 0"
        class="mt-3 flex flex-col gap-1 text-sm text-toned"
        data-testid="confirm-details"
      >
        <li
          v-for="line in props.details"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="confirm-cancel"
          @click="emit('close', false)"
        >
          {{ props.cancelLabel }}
        </UButton>
        <UButton
          :color="props.tone"
          data-testid="confirm-accept"
          @click="emit('close', true)"
        >
          {{ props.confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
