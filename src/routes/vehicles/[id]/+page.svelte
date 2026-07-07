<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import VehicleDocuments from '$lib/components/ui/VehicleDocuments.svelte'
  import { listVehicleDocumentsRemote } from '../vehicle-documents.remote'
  import {
    addVehiclePhotoRemote,
    deleteVehiclePhotoRemote,
    getVehicleRelatedRemote,
    getVehicleRemote,
    listVehiclePhotosRemote,
    setMainVehiclePhotoRemote
  } from '../vehicles.remote'
  import { getVehicleSaleSignPdfRemote } from '../sale-sign.remote'
  import PurchaseIntoStockModal from '../PurchaseIntoStockModal.svelte'
  import {
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
   * Parallel SSR-friendly load — vehicle stamm data + photos +
   * customer/invoices + document metadata arrive in one round-trip.
   * The documents list is meta-only; bytes travel exclusively through
   * `getVehicleDocumentRemote` inside the VehicleDocuments card.
   */
  const [initialVehicle, initialPhotos, initialRelated, initialDocuments] =
    await Promise.all([
      getVehicleRemote({ id }),
      listVehiclePhotosRemote({ vehicleId: id }),
      getVehicleRelatedRemote({ id, invoicesPage: 1 }),
      listVehicleDocumentsRemote({ vehicleId: id })
    ])

  /**
   * Reactive vehicle read — never memoize the query proxy. The Ankauf
   * command refreshes `getVehicleRemote({ id })` server-side in the
   * same flight; reading `.current` here flips the page to the
   * Verkaufsbestand state (header CTA, Vorbesitzer row) without a
   * remount. `initialVehicle` bridges until the cache is live.
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

  const customerLabel = (c: NonNullable<typeof customer>): string =>
    c.company ||
    `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
    c.customerNumber

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

  /** Ankauf modal (customer vehicles only — see the card below). */
  let ankaufOpen = $state(false)

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
   * Render and open the A4-landscape sale sign in a new tab. Available
   * for any vehicle — stock cars get the price + highlights, customer
   * cars still get a clean sign that the workshop can use ad-hoc.
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

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
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

  <!--
    Ankauf card — only for customer vehicles. Opens the confirm modal
    that re-hangs the vehicle into the sales stock (Vorbesitzer +
    vehicle_purchases history row).
  -->
  {#if !isStock}
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
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
          {v.mileageKm ? v.mileageKm.toLocaleString('de-DE') + ' km' : '-'}
        </dd>
        <dt class="text-base-content/60">Nächste HU</dt>
        <dd class="sm:col-span-2">{v.nextHu ?? '-'}</dd>
        {#if v.previousOwnerCustomerId}
          <dt class="text-base-content/60">Vorbesitzer</dt>
          <dd class="break-words sm:col-span-2">
            <a class="link" href={`/customers/${v.previousOwnerCustomerId}`}>
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
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Notiz</h3>
        <p class="text-sm whitespace-pre-line">{v.notes}</p>
      </div>
    </div>
  {/if}

  <!--
    Owner card — only rendered for customer-vehicles. Stock vehicles
    (customer_id IS NULL) get no owner row from the related query.
  -->
  {#if customer}
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title text-base">
            <User size={18} class="text-base-content/60" />
            Kunde
          </h3>
          <a
            class="btn btn-ghost btn-sm"
            href={`/customers/${customer.customerId}`}
          >
            Zum Kunden
          </a>
        </div>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Kundennr.</dt>
          <dd class="font-mono break-all sm:col-span-2"
            >{customer.customerNumber}</dd
          >
          <dt class="text-base-content/60">Name</dt>
          <dd class="break-words sm:col-span-2">{customerLabel(customer)}</dd>
          <dt class="text-base-content/60">Telefon</dt>
          <dd class="break-all sm:col-span-2">{customer.phone ?? '-'}</dd>
          <dt class="text-base-content/60">E-Mail</dt>
          <dd class="break-all sm:col-span-2">{customer.email ?? '-'}</dd>
        </dl>
      </div>
    </div>
  {/if}

  <!-- Paginated invoice history for this vehicle. -->
  <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
    <div class="card-body p-0">
      <div
        class="border-base-300 flex items-center justify-between border-b px-4 py-3"
      >
        <h3 class="text-base font-semibold">
          <Receipt size={18} class="text-base-content/60 mr-1 inline" />
          Rechnungen
        </h3>
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
    </div>
  </div>

  <div class="lg:col-span-2">
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

  <!-- Documents area — available for customer AND stock vehicles. -->
  <div class="lg:col-span-2">
    <VehicleDocuments vehicleId={id} initial={initialDocuments} />
  </div>
</div>

<!--
  buildUpdates hands the modal FRESH query instances built against the
  exact args this page renders (section 5 rule), so the single-flight
  response flips `v` (header CTA, Vorbesitzer row) and drops the Kunde
  card without a reload.
-->
<PurchaseIntoStockModal
  bind:open={ankaufOpen}
  vehicleId={id}
  buildUpdates={() => [
    getVehicleRemote({ id }),
    getVehicleRelatedRemote({ id, invoicesPage })
  ]}
/>
