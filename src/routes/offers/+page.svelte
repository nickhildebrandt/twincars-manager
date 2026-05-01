<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Angebote / Kostenvoranschläge"
  subtitle="Angebote, KV und Auftragsbestätigungen erstellen."
/>
<ComingSoon
  features={[
    'Gemeinsames Dokumentenmodell mit Rechnungen',
    'Positionen aus Material, Leistung, Artikel',
    'PDF-Erstellung und -Vorschau',
    'In Rechnung/Auftragsbestätigung übernehmen'
  ]}
/>
