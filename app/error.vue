<script setup lang="ts">
/**
 * Full-page error. Shows the curated German sentence and two ways out —
 * never a stack, a status code on its own or a technical detail
 * (../docs/rewrite/04-ux.md §3.7).
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const TEXTS: Record<number, { title: string, hint: string }> = {
  400: {
    title: 'Die Anfrage konnte nicht bearbeitet werden',
    hint: 'Bitte prüfen Sie Ihre Eingabe und versuchen Sie es erneut.',
  },
  401: {
    title: 'Bitte melden Sie sich an',
    hint: 'Ihre Sitzung ist abgelaufen.',
  },
  403: {
    title: 'Keine Berechtigung',
    hint: 'Für diesen Bereich fehlt Ihnen die Berechtigung. Wenden Sie sich an die Verwaltung.',
  },
  404: {
    title: 'Seite nicht gefunden',
    hint: 'Die Adresse gibt es nicht oder der Eintrag wurde entfernt.',
  },
  422: {
    title: 'Eingabe unvollständig',
    hint: 'Bitte prüfen Sie die markierten Felder.',
  },
  429: {
    title: 'Zu viele Anfragen',
    hint: 'Bitte warten Sie einen Moment und versuchen Sie es erneut.',
  },
}

const FALLBACK = {
  title: 'Ein Fehler ist aufgetreten',
  hint: 'Bitte versuchen Sie es erneut. Bleibt das Problem bestehen, wenden Sie sich an die Verwaltung.',
}

const status = computed(() => props.error?.statusCode ?? 500)
const texts = computed(() => TEXTS[status.value] ?? FALLBACK)

/**
 * Only a message that the server curated is shown. Framework strings such as
 * "Not Found" are English and must never reach the user (B-012).
 */
const detail = computed(() => {
  const message = props.error?.message?.trim()
  if (!message) return ''
  const isFrameworkText = /^[A-Za-z ]+$/.test(message)
  return isFrameworkText ? '' : message
})

useHead({ title: texts.value.title })

const back = () => (window.history.length > 1 ? window.history.back() : clearError({ redirect: '/' }))
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-default p-4">
    <UCard
      class="w-full max-w-md"
      data-testid="error-page"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-circle-alert"
            class="size-6 text-error"
          />
          <h1
            class="text-lg font-semibold"
            data-testid="error-title"
          >
            {{ texts.title }}
          </h1>
        </div>
      </template>

      <p class="text-muted">
        {{ texts.hint }}
      </p>

      <p
        v-if="detail"
        class="mt-3 text-sm text-toned"
        data-testid="error-detail"
      >
        {{ detail }}
      </p>

      <template #footer>
        <div class="flex gap-2">
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-arrow-left"
            data-testid="error-back"
            @click="back"
          >
            Zurück
          </UButton>
          <UButton
            icon="i-lucide-house"
            data-testid="error-home"
            @click="clearError({ redirect: '/' })"
          >
            Zum Start
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
