<script lang="ts">
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
    TrendingDown
  } from '@lucide/svelte'
  import { getDashboardKpis } from './dashboard.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  const kpisQ = $derived(getDashboardKpis())
  const kpis = $derived(kpisQ.current)
  const loading = $derived(kpisQ.loading)

  $effect(() => {
    if (kpisQ.error) handleClientError(kpisQ.error)
  })
</script>

<PageHeader
  title="Dashboard"
  primaryAction={{ label: 'Neue Rechnung', href: '/invoices/new', icon: Plus }}
/>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
  <StatCard title="Mahnungen" value="0" icon={AlertTriangle} color="error" />
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
    <div class="card-body">
      <h3 class="card-title text-base">Hinweise</h3>
      <p class="text-base-content/70 text-sm">
        Fällige HU-Termine, anstehende Mahnungen, Lohnläufe und wiederkehrende
        Buchungen erscheinen hier, sobald entsprechende Daten erfasst werden.
      </p>
      <p class="text-base-content/60 mt-3 text-sm">
        Über die Sidebar erreichen Sie alle Module der Anwendung. Beginnen Sie
        typischerweise mit den
        <a class="link link-primary" href="/customers">Kunden</a>,
        <a class="link link-primary" href="/vehicles">Fahrzeugen</a> oder dem
        <a class="link link-primary" href="/import">Import</a> Ihrer alten Daten.
      </p>
    </div>
  </div>
</section>
