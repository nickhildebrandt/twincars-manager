<script lang="ts">
  /**
   * SMTP settings — its own top-level settings tab (formerly an inner
   * tab on /settings; old `?tab=smtp` deep links redirect here). The
   * Testversand card stays mounted directly below the form; the test
   * always sends via the SAVED settings.
   */
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SmtpTestSend from '../SmtpTestSend.svelte'
  import {
    getAllSettingsRemote,
    sendSmtpTestMailRemote,
    updateSmtpRemote
  } from '../settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  // Never memoize the query proxy (CONTRIBUTING §5) — the save command
  // refreshes this query server-side.
  const data = $derived.by(() => getAllSettingsRemote().current)

  $effect(() => {
    const q = getAllSettingsRemote()
    if (q.error) handleClientError(q.error)
  })

  let smtpHost = $state('')
  let smtpPort = $state(587)
  let smtpSecure = $state<'none' | 'STARTTLS' | 'TLS'>('STARTTLS')
  /** True wenn der Server bereits ein Passwort gespeichert hat —
   *  dann zeigt das Feld als Visual-Cue Punkte an. Beim Tippen
   *  überschreibt der User; bleibt das Feld leer (oder Platzhalter
   *  unangetastet) wird das gespeicherte Passwort behalten. */
  let smtpPasswordSet = $state(false)
  let smtpUser = $state('')
  let smtpPassword = $state('')
  let fromAddress = $state('')
  let fromName = $state('')

  let initialised = $state(false)
  $effect(() => {
    if (!data || initialised) return
    if (data.smtp) {
      smtpHost = data.smtp.host
      smtpPort = data.smtp.port
      smtpSecure =
        (data.smtp.secure as 'none' | 'STARTTLS' | 'TLS') ?? 'STARTTLS'
      smtpUser = data.smtp.username
      smtpPasswordSet = data.smtp.hasPassword
      fromAddress = data.smtp.fromAddress
      fromName = data.smtp.fromName
    }
    initialised = true
  })

  const saveSmtp = async (e: Event) => {
    e.preventDefault()
    try {
      await busy.run(() =>
        updateSmtpRemote({
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure,
          username: smtpUser,
          password: smtpPassword || undefined,
          fromAddress,
          fromName,
          replyTo: undefined
        })
      )
      // Success — clear only now; a failure keeps the form dirty (§11).
      formDirty.clear()
      smtpPassword = ''
      toast.success('SMTP-Konfiguration gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /**
   * Pragmatic dirty check for the SMTP form: current field values vs.
   * the last-loaded server state (a typed password always counts as a
   * change). Drives the "save before testing" hint in the Testversand
   * fieldset — the test always sends via the SAVED settings. After a
   * save, `updateSmtpRemote` refreshes `getAllSettingsRemote`, so this
   * settles back to false automatically.
   */
  const smtpFormDirty = $derived.by(() => {
    const s = data?.smtp
    if (!s) {
      return (
        smtpHost !== '' ||
        smtpUser !== '' ||
        fromAddress !== '' ||
        fromName !== '' ||
        smtpPassword !== ''
      )
    }
    return (
      smtpHost !== s.host ||
      Number(smtpPort) !== s.port ||
      smtpSecure !==
        ((s.secure as 'none' | 'STARTTLS' | 'TLS') ?? 'STARTTLS') ||
      smtpUser !== s.username ||
      fromAddress !== s.fromAddress ||
      fromName !== s.fromName ||
      smtpPassword !== ''
    )
  })
</script>

<PageHeader title="SMTP" back="/settings" />

<form
  onsubmit={saveSmtp}
  oninput={markDirty}
  onchange={markDirty}
  class="flex flex-col gap-4"
>
  <fieldset class="fieldset">
    <legend class="fieldset-legend">Absender</legend>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Absender-Adresse *</span>
        <input
          class="input input-bordered w-full"
          type="email"
          maxlength="254"
          required
          bind:value={fromAddress}
        />
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Absender-Name *</span>
        <input
          class="input input-bordered w-full"
          maxlength="200"
          required
          bind:value={fromName}
        />
      </label>
    </div>
  </fieldset>
  <fieldset class="fieldset">
    <legend class="fieldset-legend">Server</legend>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex w-full flex-col gap-1 sm:col-span-2">
        <span class="label-text">SMTP-Host *</span>
        <input
          class="input input-bordered w-full"
          maxlength="255"
          required
          bind:value={smtpHost}
        />
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Port *</span>
        <input
          class="input input-bordered w-full"
          type="number"
          min="1"
          max="65535"
          required
          bind:value={smtpPort}
        />
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Verschlüsselung *</span>
        <select
          class="select select-bordered w-full"
          bind:value={smtpSecure}
          onchange={() => {
            // Standardports nach Verschlüsselungsmethode automatisch
            // setzen — User kann den Wert anschließend manuell
            // überschreiben. Mapping: keine → 25 (SMTP),
            // STARTTLS → 587 (Submission), TLS → 465 (SMTPS).
            smtpPort =
              smtpSecure === 'TLS' ? 465 : smtpSecure === 'STARTTLS' ? 587 : 25
          }}
        >
          <option value="STARTTLS">STARTTLS</option>
          <option value="TLS">TLS (SSL)</option>
          <option value="none">Keine</option>
        </select>
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Benutzername *</span>
        <input
          class="input input-bordered w-full"
          maxlength="200"
          required
          bind:value={smtpUser}
        />
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">
          Passwort {smtpPasswordSet ? '(leer lassen = behalten)' : '*'}
        </span>
        <input
          class="input input-bordered w-full"
          type="password"
          maxlength="200"
          placeholder={smtpPasswordSet ? '••••••••••' : ''}
          bind:value={smtpPassword}
        />
      </label>
    </div>
  </fieldset>
  <div class="flex justify-end">
    <button type="submit" class="btn btn-primary" disabled={busy.active}>
      Speichern
    </button>
  </div>
</form>
<SmtpTestSend
  defaultRecipient={data?.company.email ?? ''}
  dirty={smtpFormDirty}
  send={async (recipient) => await sendSmtpTestMailRemote({ recipient })}
/>
