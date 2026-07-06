<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { authClient } from '$lib/client/auth-client'
  import { busy } from '$lib/stores/busy.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { pageTitle } from '$lib/stores/page-title.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import { minLength, maxLength, object, pipe, string, trim } from 'valibot'

  $effect(() => {
    pageTitle.set('Anmelden')
    return () => pageTitle.reset()
  })

  /**
   * Per-load background gradient. Full literal class strings so
   * Tailwind's scanner picks them up; the variant is chosen client-side
   * in `onMount` (never during SSR) to avoid a hydration mismatch, and
   * fades in over the neutral base — no flash, no custom CSS.
   */
  const GRADIENTS = [
    'bg-linear-to-br from-primary/20 via-base-200 to-accent/25',
    'bg-linear-to-tr from-accent/20 via-base-200 to-primary/25',
    'bg-linear-to-bl from-info/25 via-base-200 to-primary/20',
    'bg-linear-to-r from-primary/15 via-accent/10 to-info/25',
    'bg-linear-to-tl from-success/15 via-base-200 to-primary/25',
    'bg-linear-to-b from-secondary/25 via-base-200 to-accent/20'
  ]
  let gradient = $state<string | null>(null)
  onMount(() => {
    gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]
  })

  let username = $state('')
  let password = $state('')
  let errorMessage = $state<string | null>(null)

  const loginSchema = object({
    username: pipe(
      string('Bitte einen Benutzernamen eingeben.'),
      trim(),
      minLength(3, 'Benutzername zu kurz (mind. 3 Zeichen).'),
      maxLength(64, 'Benutzername zu lang.')
    ),
    password: pipe(
      string('Bitte ein Passwort eingeben.'),
      minLength(8, 'Passwort zu kurz (mind. 8 Zeichen).'),
      maxLength(128, 'Passwort zu lang.')
    )
  })

  const fv = useFormValidation(loginSchema, () => ({ username, password }))
  const err = (k: 'username' | 'password'): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: 'username' | 'password'): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/')

  const reason = $derived(page.url.searchParams.get('reason'))
  const reasonMessage = $derived(
    reason === 'idle'
      ? 'Sie wurden wegen einer Stunde Inaktivität automatisch abgemeldet. Bitte melden Sie sich erneut an.'
      : null
  )

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    errorMessage = null
    fv.markAllTouched()
    if (!fv.valid) {
      const errs = fv.errors as Record<string, string | null>
      errorMessage =
        Object.values(errs).find((v) => v != null) ??
        'Bitte prüfen Sie Ihre Eingaben.'
      return
    }
    try {
      await busy.run(async () => {
        const { error } = await authClient.signIn.username({
          username: username.trim(),
          password
        })
        if (error) {
          errorMessage =
            error.message?.trim() ||
            'Anmeldung fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.'
          return
        }
        // FULL document load, not a client-side goto: the async root
        // layout resolved its user/permission context while anonymous;
        // a client navigation keeps that stale state (empty sidebar,
        // "half-rendered" app until a manual reload). A document load
        // re-runs the layout server-side with the fresh session.
        // Open-redirect guard: only same-origin path targets.
        const target =
          redirectTo.startsWith('/') && !redirectTo.startsWith('//')
            ? redirectTo
            : '/'
        window.location.href = target
      })
    } catch (err) {
      handleClientError(err, 'Anmeldung fehlgeschlagen.')
    }
  }
</script>

<div
  class="bg-base-200 relative flex min-h-dvh items-center justify-center overflow-hidden p-4"
>
  <div
    class="absolute inset-0 transition-opacity duration-700 {gradient ??
      ''} {gradient ? 'opacity-100' : 'opacity-0'}"
    aria-hidden="true"
  ></div>
  <div class="relative flex w-full max-w-md flex-col gap-4">
    <div class="card border-base-300 bg-base-100 w-full border">
      <div class="card-body">
        <div class="flex items-center gap-3">
          <img
            src="/icons/icon-128.webp"
            alt=""
            width="44"
            height="44"
            class="rounded-xl"
            loading="eager"
            decoding="async"
          />
          <h1 class="card-title">Anmelden</h1>
        </div>
        <p class="text-base-content/70 text-sm">
          Bitte melden Sie sich mit Ihrem Benutzernamen und Passwort an.
        </p>
        {#if reasonMessage}
          <div class="alert alert-info mt-3 text-sm" role="status">
            <span>{reasonMessage}</span>
          </div>
        {/if}
        <form
          class="mt-4 flex flex-col gap-3"
          onsubmit={handleSubmit}
          novalidate
        >
          <FormField
            label="Benutzername"
            required
            error={wasTouched('username') ? err('username') : null}
          >
            <input
              type="text"
              class={validationClasses(err('username'), wasTouched('username'))}
              bind:value={username}
              autocomplete="username"
              required
              minlength="3"
              maxlength="64"
              onblur={() => fv.markTouched('username')}
            />
          </FormField>
          <FormField
            label="Passwort"
            required
            error={wasTouched('password') ? err('password') : null}
          >
            <input
              type="password"
              class={validationClasses(err('password'), wasTouched('password'))}
              bind:value={password}
              autocomplete="current-password"
              required
              minlength="8"
              onblur={() => fv.markTouched('password')}
            />
          </FormField>
          {#if errorMessage}
            <div class="alert alert-error text-sm" role="alert">
              <span>{errorMessage}</span>
            </div>
          {/if}
          <button
            type="submit"
            class="btn btn-primary mt-2"
            disabled={busy.active}
          >
            {#if busy.active}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Anmelden
          </button>
        </form>
      </div>
    </div>
    <p class="text-base-content/60 text-center text-xs">
      TwinCarsManager · Version {__APP_VERSION__}
    </p>
  </div>
</div>
