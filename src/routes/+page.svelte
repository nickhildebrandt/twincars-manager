<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import {
    Users,
    Car,
    Receipt,
    AlertTriangle,
    Wallet,
    Plus,
    FileText,
    CalendarClock,
    Database,
    TrendingUp,
    TrendingDown,
    Wrench
  } from '@lucide/svelte'
  import { getDashboardKpis, getUpcomingRemote } from './dashboard.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  const kpisQ = $derived(getDashboardKpis())
  const kpis = $derived(kpisQ.current)
  const loading = $derived(kpisQ.loading)
  const upcoming = await untrack(() => getUpcomingRemote())

  $effect(() => {
    if (kpisQ.error) handleClientError(kpisQ.error)
  })

  const fmtDate = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
  }
</script>

<PageHeader title="Start" />

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    title="Kunden"
    value={loading ? '…' : (kpis?.customers ?? 0).toLocaleString('de-DE')}
    icon={Users}
    color="primary"
  />
  <StatCard
    title="Fahrzeuge"
    value={loading ? '…' : (kpis?.vehicles ?? 0).toLocaleString('de-DE')}
    icon={Car}
    color="info"
  />
  <StatCard
    title="Umsatz dieser Monat"
    value={loading ? '…' : formatEuro(kpis?.monthlyIncome ?? 0)}
    icon={TrendingUp}
    color="success"
  />
  <StatCard
    title="Ausgaben dieser Monat"
    value={loading ? '…' : formatEuro(kpis?.monthlyExpense ?? 0)}
    icon={TrendingDown}
    color="error"
  />
  <StatCard
    title="Offene Rechnungen"
    value="0"
    icon={Receipt}
    color="warning"
  />
  <StatCard
    title="Zahlungserinnerungen"
    value="0"
    icon={AlertTriangle}
    color="error"
  />
  <StatCard title="Termine heute" value="0" icon={CalendarClock} />
  <StatCard
    title="Saldo dieser Monat"
    value={loading ? '…' : formatEuro(kpis?.monthlyBalance ?? 0)}
    icon={Wallet}
    color={(kpis?.monthlyBalance ?? 0) >= 0 ? 'success' : 'error'}
  />
</div>

<section class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Schnelle Aktionen</h3>
      <div class="flex flex-wrap gap-2">
        <a class="btn btn-sm" href="/customers/new"
          ><Plus size={14} /> Neuer Kunde</a
        >
        <a class="btn btn-sm" href="/vehicles/new"
          ><Plus size={14} /> Neues Fahrzeug</a
        >
        <a class="btn btn-sm" href="/employees/new"
          ><Plus size={14} /> Neuer Mitarbeiter</a
        >
        <a class="btn btn-sm" href="/items/new"
          ><Plus size={14} /> Neuer Artikel</a
        >
        <a class="btn btn-sm" href="/suppliers/new"
          ><Plus size={14} /> Neuer Lieferant</a
        >
        <a class="btn btn-sm" href="/ledger/new"
          ><Plus size={14} /> Neue Buchung</a
        >
        <a class="btn btn-sm" href="/offers/new"
          ><FileText size={14} /> Neuer Kostenvoranschlag</a
        >
        <a class="btn btn-sm" href="/import"
          ><Database size={14} /> Import starten</a
        >
      </div>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body p-0">
      <div
        class="border-base-300 flex items-center justify-between border-b px-4 py-3"
      >
        <h3 class="text-base font-semibold">Anstehende Termine</h3>
        <a class="text-base-content/60 link text-sm" href="/calendar">
          Kalender öffnen →
        </a>
      </div>
      {#if upcoming.length === 0}
        <div class="text-base-content/60 px-4 py-6 text-sm">
          Aktuell keine anstehenden HU-Termine oder Werkstatt-Termine.
        </div>
      {:else}
        <ul class="menu menu-sm w-full p-0">
          {#each upcoming as u (u.kind + (u.kind === 'hu_due' ? u.vehicleId : u.entryId))}
            <li>
              <a
                class="flex items-center justify-between py-2"
                href={u.kind === 'hu_due'
                  ? `/vehicles/${u.vehicleId}`
                  : '/calendar'}
              >
                <span class="flex items-center gap-2 truncate">
                  {#if u.kind === 'hu_due'}
                    <Wrench size={14} class="text-warning shrink-0" />
                  {:else}
                    <CalendarClock size={14} class="text-info shrink-0" />
                  {/if}
                  <span class="truncate">{u.title}</span>
                </span>
                <span
                  class="text-base-content/60 ms-2 shrink-0 font-mono text-xs"
                >
                  {fmtDate(u.dateIso)}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</section>
