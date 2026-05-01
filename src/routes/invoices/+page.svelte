<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Rechnungen"
  subtitle="Rechnungen mit Positionen, Zahlungen und PDF-Versand."
/>
<ComingSoon
  features={[
    'Vollständige Rechnungserstellung mit Positionen',
    'Brutto/Netto-Berechnung, Rabatte pro Position',
    'Zahlungseingänge inkl. Teilzahlungen',
    'PDF-Versand mit vorausgefüllter Mailvorlage',
    'Automatische Buchung in der Buchhaltung'
  ]}
/>
