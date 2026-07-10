<script lang="ts">
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'

  /** Result shape of `sendSmtpTestMailRemote` / `sendSmtpTestMail`. */
  type SendResult =
    | { ok: true; messageId: string | null }
    | { ok: false; error: string }

  let {
    defaultRecipient = '',
    dirty = false,
    send
  }: {
    /** Prefill for the recipient field (company e-mail address). */
    defaultRecipient?: string
    /** True while the SMTP form above holds unsaved changes — the test
     *  always uses the SAVED settings, so we surface a hint. */
    dirty?: boolean
    /** Performs the actual test send (wired to the remote command). */
    send: (recipient: string) => Promise<SendResult>
  } = $props()

  let recipient = $state('')
  // Prefill exactly once as soon as the (async-loaded) company e-mail
  // arrives; afterwards the field is user-driven.
  let seeded = $state(false)
  $effect(() => {
    if (!seeded && defaultRecipient) {
      recipient = defaultRecipient
      seeded = true
    }
  })

  /** Click-time field validation message (German). */
  let fieldError = $state<string | null>(null)
  /** Curated server-side failure, rendered inline as an alert. */
  let inlineError = $state<string | null>(null)

  const isValidEmail = (v: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleTest = async (e: Event) => {
    e.preventDefault()
    inlineError = null
    const value = recipient.trim()
    // Click-time validation — the button itself is never disabled for
    // invalid input (rule 1.1), only `busy.active` gates it.
    if (!isValidEmail(value)) {
      fieldError = 'Bitte eine gültige Empfängeradresse eingeben.'
      return
    }
    fieldError = null
    try {
      const result = await busy.run(() => send(value))
      if (result.ok) {
        toast.success(`Testnachricht an ${value} versendet.`)
      } else {
        inlineError = result.error
      }
    } catch (err) {
      handleClientError(err, 'Testversand fehlgeschlagen')
    }
  }
</script>

<form onsubmit={handleTest} novalidate class="mt-4">
  <fieldset class="fieldset">
    <legend class="fieldset-legend">Testversand</legend>
    <p class="text-base-content/60 text-sm">
      Sendet eine Testnachricht über die zuletzt gespeicherten
      SMTP-Einstellungen.
    </p>
    {#if dirty}
      <p class="text-warning text-sm">
        Speichern Sie geänderte SMTP-Einstellungen vor dem Test.
      </p>
    {/if}
    <div class="mt-2 flex flex-wrap items-start gap-3">
      <label class="flex w-full max-w-sm flex-col gap-1">
        <span class="label-text">Empfängeradresse</span>
        <input
          class="input input-bordered w-full"
          class:input-error={!!fieldError}
          type="email"
          maxlength="254"
          bind:value={recipient}
        />
        {#if fieldError}
          <span class="text-error text-sm">{fieldError}</span>
        {/if}
      </label>
      <button type="submit" class="btn mt-6" disabled={busy.active}>
        Testnachricht senden
      </button>
    </div>
    {#if inlineError}
      <div class="alert alert-error mt-2" role="alert">
        <span>{inlineError}</span>
      </div>
    {/if}
  </fieldset>
</form>
