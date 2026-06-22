<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    listWorkshopHoursRemote,
    updateWorkshopHoursRemote
  } from './workshop-hours.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  /** Top-level await: SSR carries the 7 rows. */
  const initial = await listWorkshopHoursRemote()

  /**
   * Editable mirror of the server rows. Indexed by `weekday` (0-6) so
   * the table rows can `bind:` directly to the matching entry without
   * any per-row state explosion.
   */
  type Row = {
    weekday: number
    opensAt: string
    closesAt: string
    closed: boolean
  }
  let rows = $state<Row[]>(
    untrack(() =>
      initial.map((r) => ({
        weekday: r.weekday,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        closed: r.closed
      }))
    )
  )

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const weekdayLabel = (w: number): string => {
    switch (w) {
      case 0:
        return 'Sonntag'
      case 1:
        return 'Montag'
      case 2:
        return 'Dienstag'
      case 3:
        return 'Mittwoch'
      case 4:
        return 'Donnerstag'
      case 5:
        return 'Freitag'
      case 6:
        return 'Samstag'
      default:
        return `Tag ${w}`
    }
  }

  const saveAll = async (e: Event) => {
    e.preventDefault()
    try {
      formDirty.clear()
      await busy.run(async () => {
        // Sequential is fine: 7 small writes against a local DB, and a
        // sequential loop produces predictable error reporting when one
        // row fails validation.
        for (const r of rows) {
          await updateWorkshopHoursRemote({
            weekday: r.weekday,
            opensAt: r.opensAt,
            closesAt: r.closesAt,
            closed: r.closed
          })
        }
      })
      toast.success('Öffnungszeiten gespeichert.')
    } catch (err) {
      handleClientError(err, 'Öffnungszeiten konnten nicht gespeichert werden')
    }
  }
</script>

<PageHeader title="Werkstatt-Öffnungszeiten" back="/settings" />

<form
  onsubmit={saveAll}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body p-0">
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Wochentag</th>
            <th>Öffnet</th>
            <th>Schließt</th>
            <th>Geschlossen</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.weekday)}
            <tr>
              <td class="font-medium">{weekdayLabel(r.weekday)}</td>
              <td>
                <input
                  type="time"
                  class="input input-bordered input-sm w-full max-w-[10rem]"
                  bind:value={r.opensAt}
                  disabled={r.closed}
                />
              </td>
              <td>
                <input
                  type="time"
                  class="input input-bordered input-sm w-full max-w-[10rem]"
                  bind:value={r.closesAt}
                  disabled={r.closed}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  bind:checked={r.closed}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="card-actions border-base-300 justify-end border-t p-4">
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
