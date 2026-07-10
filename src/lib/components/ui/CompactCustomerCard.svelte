<script lang="ts">
  /**
   * Compact read-only customer card — customer number, name, phone and
   * email plus a "Zum Kunden" link to the customer detail. Used
   * wherever a related record needs to show its holder/owner without
   * embedding a full customer view (e.g. the Halter tab on the vehicle
   * detail page).
   */
  import { User } from '@lucide/svelte'

  type Props = {
    customerNumber: string
    company?: string | null
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
    email?: string | null
    /** Link target, e.g. `/customers/<id>`. */
    href: string
    /** Card title (default "Kunde"). */
    title?: string
  }

  const {
    customerNumber,
    company = null,
    firstName = null,
    lastName = null,
    phone = null,
    email = null,
    href,
    title = 'Kunde'
  }: Props = $props()

  const nameLabel = $derived(
    company || `${firstName ?? ''} ${lastName ?? ''}`.trim() || customerNumber
  )
</script>

<div class="card border-base-300 bg-base-100 min-w-0 border">
  <div class="card-body">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="card-title text-base">
        <User size={18} class="text-base-content/60" />
        {title}
      </h3>
      <a class="btn btn-ghost btn-sm" {href}>Zum Kunden</a>
    </div>
    <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
      <dt class="text-base-content/60">Kundennr.</dt>
      <dd class="font-mono break-all sm:col-span-2">{customerNumber}</dd>
      <dt class="text-base-content/60">Name</dt>
      <dd class="break-words sm:col-span-2">{nameLabel}</dd>
      <dt class="text-base-content/60">Telefon</dt>
      <dd class="break-all sm:col-span-2">{phone ?? '-'}</dd>
      <dt class="text-base-content/60">E-Mail</dt>
      <dd class="break-all sm:col-span-2">{email ?? '-'}</dd>
    </dl>
  </div>
</div>
