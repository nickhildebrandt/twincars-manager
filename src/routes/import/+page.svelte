<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { runMdbImportRemote } from './import.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { Database, Upload, AlertTriangle, Info } from '@lucide/svelte'

  type Summary = Awaited<ReturnType<typeof runMdbImportRemote>>

  let fileInput = $state<HTMLInputElement | null>(null)
  let pickedFile = $state<File | null>(null)
  let confirmOpen = $state(false)
  let resultOpen = $state(false)
  let summary = $state<Summary | null>(null)

  const onPicked = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    if (!/\.mdb$/i.test(f.name)) {
      toast.error('Bitte eine .mdb-Datei auswählen.')
      return
    }
    pickedFile = f
  }

  const readAsDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(f)
    })

  const startImport = async () => {
    if (!pickedFile) return
    confirmOpen = false
    try {
      const dataUrl = await readAsDataUrl(pickedFile)
      const res = await busy.run(() =>
        runMdbImportRemote({ fileBase64: dataUrl })
      )
      summary = res
      resultOpen = true
      pickedFile = null
      if (fileInput) fileInput.value = ''
    } catch (err) {
      handleClientError(err, 'Import fehlgeschlagen')
    }
  }

  const totalRows = (s: Summary) =>
    s.customers +
    s.vehicles +
    s.suppliers +
    s.items +
    s.invoices +
    s.invoiceItems +
    s.invoicePayments +
    s.offers +
    s.offerItems +
    s.reminders
</script>

<PageHeader title="Daten aus KFZ-Kaufmann importieren" back="/settings" />

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex items-center gap-2">
        <Database size={18} />
        <h3 class="card-title text-base">Access-Datenbank hochladen</h3>
      </div>
      <p class="text-base-content/70 text-sm">
        Wähle die <span class="font-mono">kfz-kaufmann.mdb</span> deiner alten Installation.
        Der Import liest Stammdaten und Belege ein und führt die Nummern (Kunden-,
        Rechnungs-, Angebots-Nr) lückenlos fort.
      </p>

      <div
        class="border-base-300 bg-base-200/40 flex items-center gap-3 rounded p-3"
      >
        <input
          bind:this={fileInput}
          type="file"
          accept=".mdb,application/vnd.ms-access,application/x-msaccess"
          class="file-input file-input-bordered file-input-sm w-full"
          onchange={onPicked}
          disabled={busy.active}
        />
      </div>

      {#if pickedFile}
        <div class="text-sm">
          <span class="text-base-content/60">Ausgewählt:</span>
          <span class="font-mono">{pickedFile.name}</span>
          <span class="text-base-content/60">
            ({(pickedFile.size / (1024 * 1024)).toFixed(1)} MB)
          </span>
        </div>
      {/if}

      <div class="flex justify-end">
        <button
          type="button"
          class="btn btn-primary gap-2"
          disabled={!pickedFile || busy.active}
          onclick={() => (confirmOpen = true)}
        >
          <Upload size={16} />
          Import starten
        </button>
      </div>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex items-center gap-2">
        <Info size={18} />
        <h3 class="card-title text-base">Hinweise</h3>
      </div>
      <ul class="text-base-content/70 list-inside list-disc space-y-2 text-sm">
        <li>
          Bestehende Daten in der App (Kunden, Fahrzeuge, Belege, Artikel,
          Lieferanten, Mahnungen, Lohnabrechnungen, Sonderzahlungen,
          Buchhaltungs-Einträge, Kalender-Einträge, Gesendet-Liste) werden vor
          dem Import komplett gelöscht.
        </li>
        <li>
          Einstellungen (Firmendaten, SMTP, Mailvorlagen,
          Buchhaltungs-Kategorien) bleiben unverändert.
        </li>
        <li>
          Belege werden direkt als <strong>abgeschlossen</strong> (bezahlt bzw.
          storniert) angelegt und tauchen <strong>nicht</strong> in „Gesendet" auf,
          weil sie nicht durch dieses System verschickt wurden. PDFs werden bei Bedarf
          on-demand generiert.
        </li>
        <li>
          KFZ-Kaufmann verknüpft Rechnungen <strong>nicht</strong> mit einem konkreten
          Fahrzeug. Importierte Belege haben deshalb kein Fahrzeug — die Fahrzeuge
          selbst werden aber importiert und sind weiterhin am Kunden gepflegt.
        </li>
        <li>
          Nummern werden 1:1 übernommen. Die nächste vergebene Nummer im System
          ist <span class="font-mono">max(legacy) + 1</span>.
        </li>
      </ul>
    </div>
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Import jetzt starten?"
  message="Bestehende Stammdaten und Belege werden vorher gelöscht. Der Vorgang kann je nach Datenmenge eine Minute dauern."
  confirmLabel="Jetzt importieren"
  cancelLabel="Abbrechen"
  variant="danger"
  onConfirm={startImport}
  onClose={() => {}}
/>

{#if resultOpen && summary}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-bold">Import abgeschlossen</h3>
      <p class="text-base-content/70 mt-2 text-sm">
        Insgesamt {totalRows(summary).toLocaleString('de-DE')} Datensätze übernommen.
      </p>

      <div class="border-base-300 mt-4 overflow-x-auto rounded border">
        <table class="table-sm table">
          <thead>
            <tr>
              <th>Kategorie</th>
              <th class="text-right">Importiert</th>
            </tr>
          </thead>
          <tbody>
            <tr
              ><td>Kunden</td><td class="text-right font-mono"
                >{summary.customers}</td
              ></tr
            >
            <tr
              ><td>Fahrzeuge</td><td class="text-right font-mono"
                >{summary.vehicles}</td
              ></tr
            >
            <tr
              ><td>Lieferanten</td><td class="text-right font-mono"
                >{summary.suppliers}</td
              ></tr
            >
            <tr
              ><td>Artikel / Leistungen</td><td class="text-right font-mono"
                >{summary.items}</td
              ></tr
            >
            <tr
              ><td>Rechnungen</td><td class="text-right font-mono"
                >{summary.invoices}</td
              ></tr
            >
            <tr
              ><td>Rechnungspositionen</td><td class="text-right font-mono"
                >{summary.invoiceItems}</td
              ></tr
            >
            <tr
              ><td>Teilzahlungen</td><td class="text-right font-mono"
                >{summary.invoicePayments}</td
              ></tr
            >
            <tr
              ><td>Angebote / KV / AB</td><td class="text-right font-mono"
                >{summary.offers}</td
              ></tr
            >
            <tr
              ><td>Angebotspositionen</td><td class="text-right font-mono"
                >{summary.offerItems}</td
              ></tr
            >
            <tr
              ><td>Mahnungen</td><td class="text-right font-mono"
                >{summary.reminders}</td
              ></tr
            >
            <tr
              ><td>PDFs gerendert</td><td class="text-right font-mono"
                >{summary.pdfsRendered}</td
              ></tr
            >
          </tbody>
        </table>
      </div>

      {#if summary.inventoryAdjustmentInvoiceNumbers.length > 0}
        <div class="alert alert-info mt-4 items-start">
          <AlertTriangle size={16} class="mt-0.5 shrink-0" />
          <div class="text-sm">
            <div class="font-medium">
              {summary.inventoryAdjustmentInvoiceNumbers.length} Bestandskorrektur-Rechnungen
            </div>
            <div class="text-base-content/70 mt-1">
              In der Quelle als „Bestandskorrektur" markiert. Nummern (erste
              20):
              <span class="font-mono">
                {summary.inventoryAdjustmentInvoiceNumbers
                  .slice(0, 20)
                  .join(', ')}
                {#if summary.inventoryAdjustmentInvoiceNumbers.length > 20}
                  …
                {/if}
              </span>
            </div>
          </div>
        </div>
      {/if}

      {#if summary.skipped.reminders + summary.skipped.payments + summary.skipped.invoiceItems + summary.skipped.offerItems + summary.skipped.pdfRenders > 0}
        <div class="text-base-content/60 mt-3 text-xs">
          Übersprungen:
          {summary.skipped.reminders} Mahnungen ohne Rechnung,
          {summary.skipped.payments} Teilzahlungen ohne Rechnung,
          {summary.skipped.invoiceItems} Rechnungspositionen,
          {summary.skipped.offerItems} Angebotspositionen,
          {summary.skipped.pdfRenders} PDF-Render-Fehler.
        </div>
      {/if}

      <div class="alert alert-warning mt-4 items-start text-sm">
        <Info size={16} class="mt-0.5 shrink-0" />
        <div>
          Belege wurden als „abgeschlossen" angelegt und tauchen nicht in der
          Gesendet-Liste auf. Alle PDFs wurden bereits beim Import gerendert und
          liegen im Cache — der Detail-View lädt sie unverändert aus der
          Datenbank, ohne sie neu zu erzeugen. Rechnungen sind nicht mit
          Fahrzeugen verknüpft (Quelle hatte diese Information nicht).
        </div>
      </div>

      <div class="modal-action">
        <button
          type="button"
          class="btn btn-primary"
          onclick={() => (resultOpen = false)}
        >
          Schließen
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={() => (resultOpen = false)}
    ></button>
  </div>
{/if}
