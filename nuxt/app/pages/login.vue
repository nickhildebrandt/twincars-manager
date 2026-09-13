<script setup lang="ts">
/**
 * Anmeldung.
 *
 * Benutzername und Passwort, sonst nichts. Kein Registrieren, kein Zurücksetzen
 * per Mail — die Konten legt die Verwaltung an (ADR-013).
 *
 * Falsches Passwort und unbekannter Benutzername ergeben **denselben** Satz.
 * Jeder Unterschied wäre eine Auskunft darüber, welche Zugänge es gibt.
 */
import * as v from 'valibot'
import { safeRedirectTarget } from '#shared/redirect'

definePageMeta({ layout: false })

useHead({ title: 'Anmelden' })

const route = useRoute()
const { signIn } = useAuth()
const notify = useNotify()

const schema = v.object({
  username: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Bitte den Benutzernamen eingeben.'),
    v.maxLength(64, 'Der Benutzername ist höchstens 64 Zeichen lang.'),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(1, 'Bitte das Passwort eingeben.'),
    v.maxLength(128, 'Das Passwort ist höchstens 128 Zeichen lang.'),
  ),
})

type Credentials = v.InferOutput<typeof schema>

const state = reactive<{ username: string, password: string }>({ username: '', password: '' })
const pending = ref(false)
const summary = ref('')

/** Das Ziel kommt aus der Adresszeile und wird deshalb geprüft, nie geglaubt. */
const target = computed(() => safeRedirectTarget(route.query.redirectTo as string | undefined))

/** Erklärt eine Abmeldung, die nicht der Nutzer ausgelöst hat. */
const reason = computed(() => {
  if (route.query.reason === 'idle') {
    return 'Sie wurden wegen Untätigkeit abgemeldet. Bitte melden Sie sich erneut an.'
  }
  return ''
})

async function onSubmit(event: { data: Credentials }) {
  summary.value = ''
  pending.value = true
  try {
    const result = await signIn(event.data.username, event.data.password)
    if (!result.ok) {
      summary.value = result.message
      state.password = ''
      return
    }
    notify.success('Willkommen zurück.')
    await navigateTo(target.value, { replace: true })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          TwinCarsManager
        </h1>
        <p class="text-sm text-muted">
          Bitte melden Sie sich an.
        </p>
      </template>

      <UAlert
        v-if="reason"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock"
        :description="reason"
        data-testid="login-reason"
      />

      <UAlert
        v-if="summary"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="summary"
        data-testid="login-error"
      />

      <UForm
        :schema="schema"
        :state="state"
        class="flex flex-col gap-4"
        data-testid="login-form"
        @submit="onSubmit"
      >
        <UFormField
          label="Benutzername"
          name="username"
          required
        >
          <UInput
            v-model="state.username"
            autocomplete="username"
            autocapitalize="none"
            autofocus
            class="w-full"
            data-testid="login-username"
          />
        </UFormField>

        <UFormField
          label="Passwort"
          name="password"
          required
        >
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            data-testid="login-password"
          />
        </UFormField>

        <UButton
          type="submit"
          block
          :loading="pending"
          data-testid="login-submit"
        >
          Anmelden
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
