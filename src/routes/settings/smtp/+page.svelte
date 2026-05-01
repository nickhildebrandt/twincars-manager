<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ArrowLeft } from '@lucide/svelte'
  import { getAllSettingsRemote, updateSmtpRemote } from '../settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const sQ = $derived(getAllSettingsRemote())
  const data = $derived(sQ.current)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
  })

  let smtpHost = $state('')
  let smtpPort = $state(587)
  let smtpSecure = $state<'none' | 'STARTTLS' | 'TLS'>('STARTTLS')
  let smtpUser = $state('')
  let smtpPassword = $state('')
  let fromAddress = $state('')
  let fromName = $state('')
  let initialised = $state(false)
  let busy = $state(false)

  $effect(() => {
    if (!data?.smtp || initialised) return
    smtpHost = data.smtp.host
    smtpPort = data.smtp.port
    smtpSecure = (data.smtp.secure as 'none' | 'STARTTLS' | 'TLS') ?? 'STARTTLS'
    smtpUser = data.smtp.username
    fromAddress = data.smtp.fromAddress
    fromName = data.smtp.fromName
    initialised = true
  })

  const submit = async (e: Event) => {
    e.preventDefault()
    busy = true
    try {
      await updateSmtpRemote({
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        username: smtpUser,
        password: smtpPassword || undefined,
        fromAddress,
        fromName,
        replyTo: undefined
      })
      smtpPassword = ''
      toast.success('SMTP-Konfiguration gespeichert.')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="SMTP-Server">
  {#snippet actions()}
    <button
      class="btn btn-ghost btn-sm gap-2"
      onclick={() => goto('/settings')}
    >
      <ArrowLeft size={16} /> Zurück
    </button>
  {/snippet}
</PageHeader>

{#if !data}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><span class="loading loading-spinner"></span></div>
  </div>
{:else}
  <form onsubmit={submit} class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Absender</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="form-control">
            <span class="label-text">Absender-Adresse *</span>
            <input
              class="input input-bordered"
              type="email"
              maxlength="254"
              required
              bind:value={fromAddress}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Absender-Name *</span>
            <input
              class="input input-bordered"
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
          <label class="form-control sm:col-span-2">
            <span class="label-text">SMTP-Host *</span>
            <input
              class="input input-bordered"
              maxlength="255"
              required
              bind:value={smtpHost}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Port *</span>
            <input
              class="input input-bordered"
              type="number"
              min="1"
              max="65535"
              required
              bind:value={smtpPort}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Verschlüsselung *</span>
            <select class="select select-bordered" bind:value={smtpSecure}>
              <option value="STARTTLS">STARTTLS</option>
              <option value="TLS">TLS</option>
              <option value="none">Keine</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text">Benutzername *</span>
            <input
              class="input input-bordered"
              maxlength="200"
              required
              bind:value={smtpUser}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Passwort (leer = unverändert)</span>
            <input
              class="input input-bordered"
              type="password"
              maxlength="200"
              bind:value={smtpPassword}
            />
          </label>
        </div>
      </fieldset>
      <div class="flex justify-end">
        <button type="submit" class="btn btn-primary" disabled={busy}>
          {#if busy}<span class="loading loading-spinner loading-sm"
            ></span>{/if}
          Speichern
        </button>
      </div>
    </div>
  </form>
{/if}
