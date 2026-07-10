<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { ArrowLeft, ArrowRight, Plus, Receipt, Search } from '@lucide/svelte'
  import { kanbanBoardRemote, moveWorkOrderStatusRemote } from './orders.remote'
  import { pickEmployeesRemote } from '../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /**
   * Kanban main view — three fixed columns (offen / in Bearbeitung /
   * abgeschlossen). Cards move via the arrow buttons (mobile / a11y
   * baseline) AND HTML5 drag & drop; both paths go through the same
   * optimistic `move()` handler. Moving INTO "Abgeschlossen" is never
   * possible here — completion happens only on the order detail page
   * ("Abschließen & Rechnung erstellen") because it creates the invoice.
   */
  let q = $state('')
  let qDebounced = $state('')
  let employeeId = $state('')
  let employeeLabel = $state('')
  let qTimer: ReturnType<typeof setTimeout> | null = null
  const onQueryInput = (e: Event) => {
    q = (e.target as HTMLInputElement).value
    if (qTimer) clearTimeout(qTimer)
    qTimer = setTimeout(() => {
      // Snapshot the currently shown board BEFORE the args change so
      // the table never blanks while the filtered query loads
      // (stale-while-revalidate).
      lastResult = board
      qDebounced = q
    }, 250)
  }

  // Only set filter keys carry into the arg object — `{}` and
  // `{q: undefined}` serialize to different remote-cache keys, and the
  // single-flight refresh must hit the exact instance this page holds.
  const boardArgs = $derived({
    ...(qDebounced ? { q: qDebounced } : {}),
    ...(employeeId ? { employeeId } : {})
  })
  const initial = await untrack(() => kanbanBoardRemote(boardArgs))
  let lastResult = $state<typeof initial>(initial)

  /**
   * The rendered board. `kanbanBoardRemote(...)` is deliberately
   * re-called on EVERY evaluation (never memoized in its own
   * `$derived` and never pre-read during init): a remote-query proxy
   * only holds its cache entry for the lifetime of the effect run
   * that created it. A memoized instance loses the entry as soon as
   * that run is torn down — `current` then stays `undefined` forever
   * and single-flight refreshes / optimistic overrides land on a
   * throwaway entry nothing renders (cards only moved after a full
   * reload). Re-calling per read re-acquires the entry and re-tracks
   * the resource, so refreshes, overrides and filter changes all
   * re-render. `lastResult` covers the load window after a filter
   * change (stale-while-revalidate).
   */
  const board = $derived.by(
    () => kanbanBoardRemote(boardArgs).current ?? lastResult
  )

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  type Board = typeof initial
  type Card = Board['open'][number]
  type ColumnKey = 'open' | 'in_progress' | 'done'
  type MovableStatus = 'open' | 'in_progress'

  const columns: Array<{ key: ColumnKey; label: string }> = [
    { key: 'open', label: 'Offen' },
    { key: 'in_progress', label: 'In Bearbeitung' },
    { key: 'done', label: 'Abgeschlossen' }
  ]

  const cardsOf = (key: ColumnKey): Card[] => board[key]

  /** Optimistic column move — the card jumps immediately, the same
   * response carries the authoritative board refresh. The override is
   * registered on the shared cache entry (same `boardArgs` key) the
   * live subscription above holds. */
  const move = async (card: Card, to: MovableStatus) => {
    if (card.status === to) return
    try {
      await busy.run(() =>
        moveWorkOrderStatusRemote({ id: card.id, status: to }).updates(
          kanbanBoardRemote(boardArgs).withOverride((current) => {
            const next = {
              open: current.open.filter((c) => c.id !== card.id),
              in_progress: current.in_progress.filter((c) => c.id !== card.id),
              done: current.done.filter((c) => c.id !== card.id)
            }
            next[to] = [{ ...card, status: to }, ...next[to]]
            return next
          })
        )
      )
    } catch (err) {
      handleClientError(err, 'Status konnte nicht geändert werden')
    }
  }

  /* ── HTML5 drag & drop (Tailwind classes only) ─────────────────── */

  let dragged = $state<Card | null>(null)
  let dragOverCol = $state<ColumnKey | null>(null)

  const onCardDragStart = (card: Card) => (e: DragEvent) => {
    dragged = card
    e.dataTransfer?.setData('text/plain', card.id)
  }

  const onCardDragEnd = () => {
    dragged = null
    dragOverCol = null
  }

  const onColumnDragOver = (key: ColumnKey) => (e: DragEvent) => {
    if (!dragged) return
    e.preventDefault()
    dragOverCol = key
  }

  const onColumnDragLeave = (key: ColumnKey) => () => {
    if (dragOverCol === key) dragOverCol = null
  }

  const onColumnDrop = (key: ColumnKey) => (e: DragEvent) => {
    e.preventDefault()
    const card = dragged
    dragged = null
    dragOverCol = null
    if (!card) return
    if (key === 'done') {
      // Guard (mirrors the server rule): a done order requires an
      // active invoice, so the drop is rejected with a German toast
      // and the card never leaves its column — no partial state.
      if (card.status !== 'done') {
        toast.info(
          'Abschließen ist nur über die Auftragsseite möglich ("Abschließen & Rechnung erstellen") — ohne gültige Rechnung kann ein Auftrag nicht abgeschlossen werden.'
        )
      }
      return
    }
    void move(card, key)
  }

  const openCard = (card: Card) => goto(`/orders/${card.id}`)
</script>

<PageHeader
  title="Aufträge"
  primaryAction={{ label: 'Neuer Auftrag', href: '/orders/new', icon: Plus }}
/>

<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body flex-row flex-wrap items-end gap-3 p-3">
    <label class="input input-bordered input-sm flex grow items-center gap-2">
      <Search size={14} class="opacity-60" />
      <input
        type="search"
        class="grow"
        placeholder="Auftrag, Kunde oder Nummer suchen"
        value={q}
        oninput={onQueryInput}
        maxlength="200"
      />
    </label>
    <div class="w-full sm:w-64">
      <SearchablePicker
        bind:value={employeeId}
        bind:valueLabel={employeeLabel}
        placeholder="Alle Mitarbeiter"
        dialogTitle="Mitarbeiter filtern"
        triggerSize="sm"
        search={searchEmployees}
        onSelect={() => {}}
      />
    </div>
  </div>
</div>

<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
  {#each columns as col (col.key)}
    <div
      class="card border-base-300 border {dragOverCol === col.key
        ? 'bg-base-200'
        : 'bg-base-100'}"
      role="list"
      aria-label={col.label}
      ondragover={onColumnDragOver(col.key)}
      ondragleave={onColumnDragLeave(col.key)}
      ondrop={onColumnDrop(col.key)}
    >
      <div class="card-body gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">{col.label}</h3>
          <span class="badge badge-ghost badge-sm">
            {cardsOf(col.key).length}
          </span>
        </div>

        {#if cardsOf(col.key).length === 0}
          <p class="text-base-content/60 text-sm">Keine Aufträge.</p>
        {/if}

        {#each cardsOf(col.key) as card (card.id)}
          <div
            class="card border-base-300 bg-base-100 cursor-pointer border"
            role="button"
            tabindex="0"
            draggable={card.status !== 'done'}
            ondragstart={onCardDragStart(card)}
            ondragend={onCardDragEnd}
            onclick={() => openCard(card)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openCard(card)
              }
            }}
          >
            <div class="card-body gap-1 p-3">
              <div class="flex items-start justify-between gap-2">
                <span class="font-mono text-xs">{card.orderNumber}</span>
                <div
                  class="flex gap-1"
                  role="presentation"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => e.stopPropagation()}
                >
                  {#if col.key === 'in_progress'}
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Zurück zu Offen"
                      aria-label="Zurück zu Offen"
                      disabled={busy.active}
                      onclick={() => move(card, 'open')}
                    >
                      <ArrowLeft size={14} />
                    </button>
                  {/if}
                  {#if col.key === 'open'}
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="In Bearbeitung verschieben"
                      aria-label="In Bearbeitung verschieben"
                      disabled={busy.active}
                      onclick={() => move(card, 'in_progress')}
                    >
                      <ArrowRight size={14} />
                    </button>
                  {/if}
                  {#if col.key === 'done' && card.invoiceId === null}
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      title="Wieder öffnen (in Bearbeitung)"
                      aria-label="Wieder öffnen (in Bearbeitung)"
                      disabled={busy.active}
                      onclick={() => move(card, 'in_progress')}
                    >
                      <ArrowLeft size={14} />
                    </button>
                  {/if}
                </div>
              </div>

              <div class="text-sm font-medium break-words">{card.title}</div>

              {#if card.customerLabel || card.vehiclePlate}
                <div class="text-base-content/60 text-xs break-words">
                  {[card.customerLabel, card.vehiclePlate]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              {/if}

              {#if card.assignees.length > 0}
                <div class="flex flex-wrap gap-1 pt-1">
                  {#each card.assignees as assignee (assignee.id)}
                    <span class="badge badge-ghost badge-sm">
                      {assignee.label}
                    </span>
                  {/each}
                </div>
              {/if}

              {#if col.key === 'done' && card.invoiceId}
                <div
                  role="presentation"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => e.stopPropagation()}
                >
                  <a
                    href={`/invoices/${card.invoiceId}`}
                    class="link link-primary inline-flex items-center gap-1 text-xs"
                  >
                    <Receipt size={12} />
                    Rechnung {card.invoiceNumber}
                  </a>
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if col.key === 'done' && cardsOf('done').length > 0}
          <p class="text-base-content/60 text-xs">
            Zeigt die letzten 25 abgeschlossenen Aufträge.
          </p>
        {/if}
      </div>
    </div>
  {/each}
</div>
