<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import VehicleDocuments from '$lib/components/ui/VehicleDocuments.svelte'
  import CompactCustomerCard from '$lib/components/ui/CompactCustomerCard.svelte'
  import TabGroup, { type TabItem } from '$lib/components/ui/TabGroup.svelte'
  import { listVehicleDocumentsRemote } from '../vehicle-documents.remote'
  import {
    addVehiclePhotoRemote,
    deleteVehiclePhotoRemote,
    getVehicleRelatedRemote,
    getVehicleRemote,
    listVehiclePhotosRemote,
    setMainVehiclePhotoRemote,
    setVehicleArchivedRemote
  } from '../vehicles.remote'
  import { getVehicleSaleSignPdfRemote } from '../sale-sign.remote'
  import PurchaseIntoStockModal from '../PurchaseIntoStockModal.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import {
    Archive,
    ArchiveRestore,
    Car,
    FileText,
    Images,
    Pencil,
    Printer,
    Receipt,
    ShoppingCart,
    User,
    Warehouse
  } from '@lucide/svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'
  import {
    documentStatusLabel,
    documentStatusBadge
  } from '$lib/utils/status-labels'
  import { openPdfInNewTab } from '$lib/utils/pdf-download'

  const id = untrack(() => page.params.id!)
  let invoicesPage = $state(1)

  /**
   * Parallel SSR-friendly load — vehicle stamm data, customer/invoices
   * and document metadata arrive in one round-trip. The documents list
   * is meta-only; bytes travel exclusively through
   * `getVehicleDocumentRemote` inside the VehicleDocuments card.
   */
  const [initialVehicle, initialRelated, initialDocuments] = await Promise.all([
    getVehicleRemote({ id }),
    getVehicleRelatedRemote({ id, invoicesPage: 1 }),
    listVehicleDocumentsRemote({ vehicleId: id })
  ])

  /**
   * Photos are a stock-vehicle feature (sale listing gallery), so they
   * are only fetched for stock vehicles — the server guards the photo
   * remotes the same way. Customer vehicles get no Fotos tab.
   */
  const initialPhotos = initialVehicle.customerId
    ? []
    : await listVehiclePhotosRemote({ vehicleId: id })

  /**
   * Reactive vehicle read — never memoize the query proxy. The Ankauf
   * command refreshes `getVehicleRemote({ id })` server-side in the
   * same flight; reading `.current` here flips the page to the
   * Verkaufsbestand state (header CTA, tab set, Vorbesitzer row)
   * without a remount. `initialVehicle` bridges until the cache is
   * live.
   */
  const v = $derived.by(
    () => getVehicleRemote({ id }).current ?? initialVehicle
  )

  // Never memoize the query proxy (CONTRIBUTING §5) — mutations
  // refresh `getVehicleRelatedRemote` server-side and the related
  // cards must pick the fresh value up without a reload.
  const related = $derived.by(
    () =>
      getVehicleRelatedRemote({ id, invoicesPage }).current ?? initialRelated
  )
  const customer = $derived(related.customer)
  const invoices = $derived(related.invoices)

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  /**
   * Bestandsfahrzeug = kein Kunde verknüpft. Auf solchen Detailseiten
   * blenden wir oben den "Verkaufen"-CTA ein, der wie aus der
   * Inventory-Liste in den Rechnungs-Wizard mit `vehicleId=` springt.
   */
  const isStock = $derived(!v.customerId)
  const headerAction = $derived(
    isStock
      ? {
          label: 'Verkaufen',
          href: `/invoices/new?vehicleId=${v.id}`,
          icon: ShoppingCart
        }
      : { label: 'Bearbeiten', href: `/vehicles/${v.id}/edit`, icon: Pencil }
  )

  /**
   * Detail tabs (standard TabGroup, `?tab=` deep links). The tab set is
   * conditional: Halter exists only for customer vehicles, Fotos only
   * for stock vehicles — after an Ankauf the set flips in place and
   * TabGroup falls back to Übersicht if the active tab disappears.
   */
  const detailTabs = $derived.by((): TabItem[] => {
    const tabs: TabItem[] = [
      { id: 'uebersicht', label: 'Übersicht', icon: Car }
    ]
    if (customer) tabs.push({ id: 'halter', label: 'Halter', icon: User })
    tabs.push({
      id: 'rechnungen',
      label: 'Rechnungen',
      icon: Receipt,
      badge: invoices.total
    })
    if (isStock) tabs.push({ id: 'fotos', label: 'Fotos', icon: Images })
    tabs.push({ id: 'dokumente', label: 'Dokumente', icon: FileText })
    return tabs
  })

  /** Ankauf modal (customer vehicles only — see the card below). */
  let ankaufOpen = $state(false)

  /** Human-readable vehicle label for confirm messages and toasts. */
  const vehicleLabel = $derived(
    `${v.make ?? ''} ${v.model ?? ''}`.trim() || v.licensePlate || 'Fahrzeug'
  )

  /**
   * Archive / reactivate flow (soft delete). Both directions confirm
   * via ConfirmDialog; the command's server-side refresh of
   * `getVehicleRemote({ id })` flips the page state in one flight.
   */
  let archiveConfirmOpen = $state(false)

  const toggleArchived = async () => {
    const next = !v.archived
    try {
      await busy.run(() =>
        setVehicleArchivedRemote({ id: v.id, archived: next })
      )
      toast.success(next ? 'Fahrzeug archiviert.' : 'Fahrzeug reaktiviert.')
    } catch (err) {
      handleClientError(
        err,
        next
          ? 'Fahrzeug konnte nicht archiviert werden'
          : 'Fahrzeug konnte nicht reaktiviert werden'
      )
    }
  }

  /**
   * Imperative state for the photo gallery — same pattern as the
   * reminders / absences lists. Top-level-await seeds, mutations
   * re-fetch via `.run()`.
   */
  let photos = $state<typeof initialPhotos>(initialPhotos)
  const refresh = async () => {
    photos = await listVehiclePhotosRemote({ vehicleId: id }).run()
  }

  const onUpload = async (file: { mime: string; dataUrl: string }) => {
    try {
      await addVehiclePhotoRemote({
        vehicleId: id,
        mime: file.mime,
        dataUrl: file.dataUrl
      })
      await refresh()
      toast.success('Foto hinzugefügt.')
    } catch (err) {
      handleClientError(err, 'Foto konnte nicht gespeichert werden')
      throw err
    }
  }

  const onDelete = async (photoId: string) => {
    try {
      await deleteVehiclePhotoRemote({ id: photoId, vehicleId: id })
      await refresh()
      toast.success('Foto gelöscht.')
    } catch (err) {
      handleClientError(err)
      throw err
    }
  }

  const onSetMain = async (photoId: string) => {
    try {
      await setMainVehiclePhotoRemote({ id: photoId, vehicleId: id })
      await refresh()
    } catch (err) {
      handleClientError(err)
      throw err
    }
  }

  /**
   * Render and open the A4-landscape sale sign in a new tab. A sale
   * sign is a stock-vehicle artifact — the button (and the server
   * guard) exists only while the vehicle is in the Verkaufsbestand.
   */
  const printSaleSign = async () => {
    try {
      const res = await busy.run(() =>
        getVehicleSaleSignPdfRemote({ id }).run()
      )
      openPdfInNewTab(res)
    } catch (err) {
      handleClientError(err, 'Verkaufsschild konnte nicht erzeugt werden')
    }
  }
</script>

<PageHeader
  title={`${v.make ?? ''} ${v.model ?? ''}`.trim() || 'Fahrzeug'}
  back={isStock ? '/inventory' : '/vehicles'}
  primaryAction={headerAction}
/>

{#if v.archived}
  <div class="alert alert-warning mb-4" role="status">
    <Archive size={18} />
    <span>
      Dieses Fahrzeug ist archiviert und erscheint nicht mehr in Listen, Suche
      und Auswahlfeldern.
    </span>
  </div>
{/if}

<TabGroup name="vehicle_detail_tabs" tabs={detailTabs} contentClass="p-0">
  {#snippet content(tabId)}
    {#if tabId === 'uebersicht'}
      <div class="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <!--
          Sale sign card — stock vehicles only. Customer vehicles get
          neither the button nor the server-side render.
        -->
        {#if isStock}
          <div
            class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2"
          >
            <div
              class="card-body flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <h3 class="card-title text-base">Verkaufsschild</h3>
                <p class="text-base-content/60 text-sm">
                  A4-Querformat zum Aushängen am Fahrzeug, mit QR-Code zur
                  Online-Ansicht.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline gap-2 sm:w-auto"
                disabled={busy.active}
                onclick={printSaleSign}
              >
                <Printer size={16} />
                Verkaufsschild drucken
              </button>
            </div>
          </div>
        {:else}
          <!--
            Ankauf card — only for customer vehicles. Opens the confirm
            modal that re-hangs the vehicle into the sales stock
            (Vorbesitzer + vehicle_purchases history row).
          -->
          <div
            class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2"
          >
            <div
              class="card-body flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <h3 class="card-title text-base">Ankauf</h3>
                <p class="text-base-content/60 text-sm">
                  Fahrzeug vom Kunden ankaufen: der Halter wird als Vorbesitzer
                  vermerkt und das Fahrzeug wandert in den Verkaufsbestand.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline gap-2 sm:w-auto"
                disabled={busy.active}
                onclick={() => (ankaufOpen = true)}
              >
                <Warehouse size={16} />
                Ankauf (in Verkaufsbestand übernehmen)
              </button>
            </div>
          </div>
        {/if}

        <!--
          Archive card — the soft-delete path. Vehicles with linked
          documents, work orders or tire storage cannot be hard-deleted
          (409 guard); archiving hides them from lists, pickers and
          search instead.
        -->
        <div
          class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2"
        >
          <div
            class="card-body flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <h3 class="card-title text-base">Archiv</h3>
              <p class="text-base-content/60 text-sm">
                {v.archived
                  ? 'Das Fahrzeug ist archiviert. Reaktivieren macht es wieder in Listen, Suche und Auswahlfeldern sichtbar.'
                  : 'Archivieren blendet das Fahrzeug aus Listen, Suche und Auswahlfeldern aus; alle verknüpften Daten bleiben erhalten.'}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline gap-2 sm:w-auto"
              disabled={busy.active}
              onclick={() => (archiveConfirmOpen = true)}
            >
              {#if v.archived}
                <ArchiveRestore size={16} />
                Reaktivieren
              {:else}
                <Archive size={16} />
                Archivieren
              {/if}
            </button>
          </div>
        </div>

        <div class="card border-base-300 bg-base-100 min-w-0 border">
          <div class="card-body">
            <h3 class="card-title text-base">Stammdaten</h3>
            <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
              <dt class="text-base-content/60">Marke</dt>
              <dd class="break-words sm:col-span-2">{v.make ?? '-'}</dd>
              <dt class="text-base-content/60">Modell</dt>
              <dd class="break-words sm:col-span-2">{v.model ?? '-'}</dd>
              <dt class="text-base-content/60">Kennzeichen</dt>
              <dd class="font-mono break-all sm:col-span-2"
                >{v.licensePlate ?? '-'}</dd
              >
              <dt class="text-base-content/60">FIN</dt>
              <dd class="font-mono break-all sm:col-span-2">{v.vin ?? '-'}</dd>
              <dt class="text-base-content/60">Erstzulassung</dt>
              <dd class="sm:col-span-2">{v.firstRegistration ?? '-'}</dd>
              <dt class="text-base-content/60">km-Stand</dt>
              <dd class="sm:col-span-2">
                {v.mileageKm
                  ? v.mileageKm.toLocaleString('de-DE') + ' km'
                  : '-'}
              </dd>
              <dt class="text-base-content/60">Nächste HU</dt>
              <dd class="sm:col-span-2">{v.nextHu ?? '-'}</dd>
              {#if v.previousOwnerCustomerId}
                <dt class="text-base-content/60">Vorbesitzer</dt>
                <dd class="break-words sm:col-span-2">
                  <a
                    class="link"
                    href={`/customers/${v.previousOwnerCustomerId}`}
                  >
                    {v.previousOwnerLabel ?? 'Zum Kunden'}
                  </a>
                </dd>
              {/if}
            </dl>
          </div>
        </div>

        <div class="card border-base-300 bg-base-100 min-w-0 border">
          <div class="card-body">
            <h3 class="card-title text-base">Technik</h3>
            <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
              <dt class="text-base-content/60">HSN/TSN</dt>
              <dd class="break-all sm:col-span-2"
                >{[v.hsn, v.tsn].filter(Boolean).join(' / ') || '-'}</dd
              >
              <dt class="text-base-content/60">Hubraum</dt>
              <dd class="sm:col-span-2"
                >{v.displacementCcm ? `${v.displacementCcm} ccm` : '-'}</dd
              >
              <dt class="text-base-content/60">kW</dt>
              <dd class="sm:col-span-2">{v.powerKw ?? '-'}</dd>
              <dt class="text-base-content/60">Kraftstoff</dt>
              <dd class="sm:col-span-2">{v.fuelType ?? '-'}</dd>
              <dt class="text-base-content/60">Getriebe</dt>
              <dd class="sm:col-span-2">{v.gearbox ?? '-'}</dd>
              <dt class="text-base-content/60">Aufbau</dt>
              <dd class="break-words sm:col-span-2">{v.bodyType ?? '-'}</dd>
            </dl>
          </div>
        </div>

        {#if v.notes}
          <div
            class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2"
          >
            <div class="card-body">
              <h3 class="card-title text-base">Notiz</h3>
              <p class="text-sm whitespace-pre-line">{v.notes}</p>
            </div>
          </div>
        {/if}
      </div>
    {:else if tabId === 'halter'}
      <!--
        Holder tab — customer vehicles only. A compact read-only card
        with a link to the customer detail; never an embedded full
        customer page.
      -->
      {#if customer}
        <div class="p-4">
          <CompactCustomerCard
            customerNumber={customer.customerNumber}
            company={customer.company}
            firstName={customer.firstName}
            lastName={customer.lastName}
            phone={customer.phone}
            email={customer.email}
            href={`/customers/${customer.customerId}`}
          />
        </div>
      {/if}
    {:else if tabId === 'rechnungen'}
      <!-- Paginated invoice history for this vehicle. -->
      <div
        class="border-base-300 flex items-center justify-between border-b px-4 py-3"
      >
        <h3 class="text-base font-semibold">Rechnungen</h3>
        <span class="text-base-content/60 text-sm">
          {invoices.total}
          {invoices.total === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>
      {#if invoices.items.length === 0}
        <div class="text-base-content/60 px-4 py-6 text-sm">
          Keine Rechnungen für dieses Fahrzeug.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Status</th>
                <th>Rechnungsdatum</th>
                <th>Fällig</th>
                <th class="text-right">Brutto</th>
              </tr>
            </thead>
            <tbody>
              {#each invoices.items as inv (inv.id)}
                <tr
                  class="hover:bg-base-200 cursor-pointer"
                  onclick={() => goto(`/invoices/${inv.id}`)}
                >
                  <td class="font-mono">{inv.documentNumber}</td>
                  <td>
                    <span
                      class="badge badge-sm {documentStatusBadge(inv.status)}"
                    >
                      {documentStatusLabel(inv.status)}
                    </span>
                  </td>
                  <td>{fmtDate(inv.issueDate)}</td>
                  <td>{fmtDate(inv.dueDate)}</td>
                  <td class="text-right font-mono">
                    {formatEuro(Number(inv.grossTotal ?? 0))}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <Pagination
          total={invoices.total}
          page={invoices.page}
          pageCount={invoices.pageCount}
          size={invoices.size}
          onPage={(p) => (invoicesPage = p)}
        />
      {/if}
    {:else if tabId === 'fotos'}
      <!-- Photo gallery — stock vehicles only (sale listing images). -->
      {#if isStock}
        <div class="p-4">
          <ImageUploader
            title="Fotos"
            hint="Beliebig viele Fotos; ein Bild lässt sich als Cover auszeichnen."
            images={photos.map((p) => ({
              id: p.id,
              dataUrl: p.dataUrl,
              isMain: p.isMain
            }))}
            {onUpload}
            {onDelete}
            {onSetMain}
          />
        </div>
      {/if}
    {:else if tabId === 'dokumente'}
      <!-- Documents area — available for customer AND stock vehicles. -->
      <div class="p-4">
        <VehicleDocuments vehicleId={id} initial={initialDocuments} />
      </div>
    {/if}
  {/snippet}
</TabGroup>

<!--
  buildUpdates hands the modal FRESH query instances built against the
  exact args this page renders (section 5 rule), so the single-flight
  response flips `v` (header CTA, tab set, Vorbesitzer row) and drops
  the Halter tab without a reload.
-->
<PurchaseIntoStockModal
  bind:open={ankaufOpen}
  vehicleId={id}
  buildUpdates={() => [
    getVehicleRemote({ id }),
    getVehicleRelatedRemote({ id, invoicesPage })
  ]}
/>

<ConfirmDialog
  bind:open={archiveConfirmOpen}
  title={v.archived ? 'Fahrzeug reaktivieren?' : 'Fahrzeug archivieren?'}
  message={v.archived
    ? `Soll das Fahrzeug "${vehicleLabel}" wieder aktiviert werden? Es erscheint danach wieder in Listen, Suche und Auswahlfeldern.`
    : `Soll das Fahrzeug "${vehicleLabel}" archiviert werden? Es verschwindet aus Listen, Suche und Auswahlfeldern; alle verknüpften Daten bleiben erhalten.`}
  confirmLabel={v.archived ? 'Reaktivieren' : 'Archivieren'}
  variant="primary"
  onConfirm={toggleArchived}
  onClose={() => (archiveConfirmOpen = false)}
/>
