<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ChevronLeft, ChevronRight, Plus } from '@lucide/svelte'
  import { listCalendarEventsRemote } from './calendar.remote'
  import { handleClientError } from '$lib/utils/client-error'

  /* — View state — */
  const today = new Date()
  let viewYear = $state(today.getUTCFullYear())
  let viewMonth = $state(today.getUTCMonth() + 1) // 1..12

  const ym = $derived(
    `${viewYear}-${String(viewMonth).padStart(2, '0')}` as const
  )
  const fromIso = $derived(`${ym}-01`)
  const toIso = $derived.by(() => {
    const last = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    return `${ym}-${String(last).padStart(2, '0')}`
  })

  /* — Calendar events query (month bucket). — */
  const eventsQ = $derived(
    listCalendarEventsRemote({ from: fromIso, to: toIso })
  )
  const initialEvents = await untrack(() => eventsQ)
  const events = $derived(eventsQ.current ?? initialEvents)

  $effect(() => {
    if (eventsQ.error) handleClientError(eventsQ.error)
  })

  /**
   * Klick-Ziel pro Event-Kind. Termine + Schließungen führen zur
   * Edit-Seite; HU-Fälligkeit zum Fahrzeug. Feiertage und
   * Mitarbeiter-Abwesenheiten sind nicht klickbar (kein direkter
   * "edit"-Pfad — Abwesenheiten werden im Mitarbeiter-Datenblatt
   * gepflegt, Feiertage stammen aus dem Bundesland-Stamm).
   */
  const eventTarget = (ev: {
    kind: string
    sourceId?: string
    employeeId?: string | null
  }): string | null => {
    if (ev.kind === 'appointment' || ev.kind === 'business_closure') {
      return ev.sourceId ? `/calendar/${ev.sourceId}/edit` : null
    }
    if (ev.kind === 'hu_due') {
      return ev.sourceId ? `/vehicles/${ev.sourceId}` : null
    }
    if (
      ev.kind === 'employee_vacation' ||
      ev.kind === 'employee_sick' ||
      ev.kind === 'employee_other'
    ) {
      // Klick auf Urlaub/Krankheit/Sonstiges öffnet das
      // Mitarbeiter-Datenblatt — dort steht die Abwesenheits-Karte
      // (mit Jahres-Selektor) für die direkte Bearbeitung.
      return ev.employeeId ? `/employees/${ev.employeeId}` : null
    }
    return null
  }

  /* — Month-grid math: render 6 weeks Mon..Sun starting before the 1st. — */
  const monthLabel = (m: number) =>
    [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember'
    ][m - 1] ?? String(m)

  const gridDays = $derived.by(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth - 1, 1))
    const dow = (first.getUTCDay() + 6) % 7 // Mon=0..Sun=6
    const start = new Date(first)
    start.setUTCDate(first.getUTCDate() - dow)
    const days: Array<{ iso: string; inMonth: boolean }> = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      days.push({
        iso: d.toISOString().slice(0, 10),
        inMonth: d.getUTCMonth() === viewMonth - 1
      })
    }
    return days
  })

  const eventsByDay = $derived.by(() => {
    const map = new Map<string, typeof events>()
    for (const ev of events) {
      const arr = map.get(ev.dateIso) ?? []
      arr.push(ev)
      map.set(ev.dateIso, arr)
    }
    return map
  })

  const eventClass = (kind: string): string => {
    switch (kind) {
      case 'public_holiday':
        return 'bg-error/10 text-error'
      case 'business_closure':
        return 'bg-base-300 text-base-content/70'
      case 'employee_vacation':
        return 'bg-info/10 text-info'
      case 'employee_sick':
        return 'bg-warning/10 text-warning'
      case 'employee_other':
        return 'bg-neutral/10 text-base-content/70'
      case 'hu_due':
        return 'bg-warning/15 text-warning'
      default:
        return 'bg-primary/10 text-primary'
    }
  }

  const prev = () => {
    if (viewMonth === 1) {
      viewMonth = 12
      viewYear -= 1
    } else viewMonth -= 1
  }
  const next = () => {
    if (viewMonth === 12) {
      viewMonth = 1
      viewYear += 1
    } else viewMonth += 1
  }
  const goToday = () => {
    viewYear = today.getUTCFullYear()
    viewMonth = today.getUTCMonth() + 1
  }
</script>

<PageHeader
  title="Kalender"
  primaryAction={{
    label: 'Termin hinzufügen',
    href: '/calendar/new',
    icon: Plus
  }}
/>

<!--
  Vollhöhen-Layout: das umschließende `flex flex-col h-full` lässt
  die Grid-Karte den gesamten Rest unterhalb der Toolbar einnehmen.
  Die Tageszellen tragen `min-h-0`, sonst würden sie ihre intrinsische
  Mindesthöhe nicht aufgeben können — das Grid ist dann nicht mehr
  vertikal flexibel.
-->
<div class="flex h-full flex-col gap-4">
  <!-- Toolbar: month nav (left) + month label (right) -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body flex flex-row items-center gap-2 p-3">
      <div class="join">
        <button class="btn btn-sm join-item" onclick={prev} aria-label="Zurück">
          <ChevronLeft size={14} />
        </button>
        <button class="btn btn-sm join-item" onclick={goToday}>Heute</button>
        <button class="btn btn-sm join-item" onclick={next} aria-label="Weiter">
          <ChevronRight size={14} />
        </button>
      </div>
      <h2 class="ms-auto text-lg font-semibold">
        {monthLabel(viewMonth)}
        {viewYear}
      </h2>
    </div>
  </div>

  <!-- Month grid füllt verbleibende Höhe -->
  <div
    class="card border-base-300 bg-base-100 flex min-h-0 flex-1 overflow-hidden border"
  >
    <div class="card-body flex h-full flex-col p-0">
      <div
        class="border-base-300 text-base-content/60 grid grid-cols-7 border-b text-xs font-semibold"
      >
        {#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as d (d)}
          <div class="px-2 py-2 text-center">{d}</div>
        {/each}
      </div>
      <div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-auto">
        {#each gridDays as day, i (day.iso + i)}
          {@const dayEvents = eventsByDay.get(day.iso) ?? []}
          <div
            class="border-base-300 flex min-h-0 flex-col overflow-hidden border-r border-b p-1 text-xs"
            class:bg-base-200={!day.inMonth}
            class:opacity-60={!day.inMonth}
          >
            <div class="text-base-content/60 mb-1 text-[11px] font-medium">
              {Number(day.iso.slice(8, 10))}
            </div>
            <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {#each dayEvents as ev (ev.id)}
                {@const target = eventTarget(ev)}
                {#if target}
                  <button
                    type="button"
                    class="cursor-pointer truncate rounded px-1 py-0.5 text-left transition-opacity hover:opacity-80 {eventClass(
                      ev.kind
                    )}"
                    onclick={() => goto(target)}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                {:else}
                  <span
                    class="truncate rounded px-1 py-0.5 {eventClass(ev.kind)}"
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
