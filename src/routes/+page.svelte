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
    Database
  } from '@lucide/svelte'
</script>

<PageHeader
  title="Dashboard"
  subtitle="Willkommen zurück. Hier sehen Sie alles Wichtige auf einen Blick."
>
  {#snippet actions()}
    <a class="btn btn-primary btn-sm gap-2" href="/invoices/new">
      <Plus size={16} /> Neue Rechnung
    </a>
  {/snippet}
</PageHeader>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard title="Kunden" value="–" icon={Users} color="primary" />
  <StatCard title="Fahrzeuge" value="–" icon={Car} color="info" />
  <StatCard
    title="Offene Rechnungen"
    value="–"
    icon={Receipt}
    color="warning"
  />
  <StatCard title="Mahnungen" value="–" icon={AlertTriangle} color="error" />
  <StatCard
    title="Umsatz dieser Monat"
    value="–"
    icon={Wallet}
    color="success"
  />
  <StatCard title="Termine heute" value="–" icon={CalendarClock} />
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
        <a class="btn btn-sm" href="/offers/new"
          ><FileText size={14} /> Neuer Kostenvoranschlag</a
        >
        <a class="btn btn-sm" href="/appointments/new"
          ><CalendarClock size={14} /> Neuer Termin</a
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
        Buchungen erscheinen hier, sobald Daten vorhanden sind.
      </p>
    </div>
  </div>
</section>
