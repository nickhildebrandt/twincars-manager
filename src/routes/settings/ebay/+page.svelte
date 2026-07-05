<script lang="ts">
  import { onMount } from 'svelte'
  import { replaceState } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import {
    Store,
    Link2,
    Unlink,
    CircleCheck,
    CircleAlert
  } from '@lucide/svelte'
  import {
    getEbayStatusRemote,
    startEbayConnectRemote,
    disconnectEbayRemote
  } from './ebay.remote'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'

  const query = getEbayStatusRemote()
  const initial = await query
  const status = $derived(query.current ?? initial)

  // Round-trip result from the OAuth callback redirect
  // (?connected=1 | ?error=declined|state|exchange).
  //
  // Deliberately deferred + read from window.location, NOT from
  // `$app/state`'s `page.url` and NOT via afterNavigate: async pages
  // (top-level await) currently fail hydration app-wide and recover
  // by client re-rendering — reading `page.url` at init makes it
  // worse, and afterNavigate callbacks registered by the recovered
  // component never fire (the initial navigation is already over).
  // A deferred onMount handler runs in BOTH worlds: after clean
  // hydration and after a hydration-recovery re-mount, when the
  // router is initialised so replaceState is safe.
  onMount(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const flag = params.has('connected') ? 'connected' : params.get('error')
      if (!flag) return
      if (flag === 'connected') {
        toast.success('eBay-Konto erfolgreich verbunden.')
      } else if (flag === 'declined') {
        toast.error('Die Verbindung wurde bei eBay abgelehnt.')
      } else if (flag === 'state') {
        toast.error(
          'Die Anfrage war abgelaufen oder ungültig. Bitte erneut verbinden.'
        )
      } else {
        toast.error('Der Token-Austausch mit eBay ist fehlgeschlagen.')
      }
      // Strip the flag so a reload doesn't re-toast.
      replaceState('/settings/ebay', {})
    }, 150)
    return () => clearTimeout(timer)
  })

  let confirmOpen = $state(false)

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toLocaleString('de-DE') : '—'

  const connect = async () => {
    try {
      const { url } = await busy.run(() => startEbayConnectRemote())
      window.location.href = url
    } catch (err) {
      handleClientError(err, 'Verbindung konnte nicht gestartet werden')
    }
  }

  const disconnect = async () => {
    try {
      await busy.run(() => disconnectEbayRemote())
      toast.success('eBay-Verbindung getrennt.')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="eBay-Verbindung" back="/settings" />

<div class="grid grid-cols-1 gap-4">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex items-center gap-2">
        <Store size={22} class="text-primary" />
        <h3 class="card-title text-base">eBay-Verkäuferkonto</h3>
        {#if status.environment === 'sandbox'}
          <span class="badge badge-warning badge-sm">Sandbox</span>
        {/if}
      </div>

      {#if !status.configured}
        <div class="alert alert-warning text-sm" role="alert">
          <CircleAlert size={16} />
          <span>
            Die eBay-Anbindung ist serverseitig noch nicht vollständig
            konfiguriert. Fehlende Umgebungsvariablen:
            <span class="font-mono">{status.missingConfig.join(', ')}</span>.
            Werte stammen aus dem eBay-Developer-Portal (Application Keys / User
            Tokens) und gehören in die Server-Konfiguration.
          </span>
        </div>
      {:else if status.connected}
        <div class="alert alert-success text-sm" role="status">
          <CircleCheck size={16} />
          <span>
            Verbunden{#if status.ebayUsername}
              als <strong>{status.ebayUsername}</strong>{/if} seit
            {fmt(status.connectedAt)}.
          </span>
        </div>
        <dl
          class="text-base-content/80 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]"
        >
          <dt class="text-base-content/50">Access-Token gültig bis</dt>
          <dd>{fmt(status.accessTokenExpiresAt)} (wird automatisch erneuert)</dd
          >
          <dt class="text-base-content/50">Verbindung läuft ab</dt>
          <dd>{fmt(status.refreshTokenExpiresAt)}</dd>
        </dl>
        <div class="card-actions justify-end">
          <button
            type="button"
            class="btn btn-ghost text-error gap-2"
            onclick={() => (confirmOpen = true)}
            disabled={busy.active}
          >
            <Unlink size={16} /> Verbindung trennen
          </button>
        </div>
      {:else}
        <p class="text-base-content/70 text-sm">
          Verbinden Sie das eBay-Verkäuferkonto der Werkstatt, um den
          Reifenbestand mit eBay zu synchronisieren. Sie werden zu eBay
          weitergeleitet und melden sich dort mit dem Verkäuferkonto an.
        </p>
        <div class="card-actions justify-end">
          <button
            type="button"
            class="btn btn-primary gap-2"
            onclick={connect}
            disabled={busy.active}
          >
            {#if busy.active}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            <Link2 size={16} /> Mit eBay verbinden
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="eBay-Verbindung trennen?"
  message="Die gespeicherten Zugriffstoken werden gelöscht. Die Synchronisation stoppt, bis das Konto erneut verbunden wird."
  confirmLabel="Trennen"
  variant="danger"
  onConfirm={disconnect}
  onClose={() => (confirmOpen = false)}
/>
