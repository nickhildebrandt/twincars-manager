<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Import (Kfz-Kaufmann)"
  subtitle="Alte .mdb-Datenbank importieren."
/>
<ComingSoon
  features={[
    'Nur .mdb akzeptiert, In-Memory verarbeitet',
    'Mapping- und Daten-Vorschau vor dem Import',
    'Idempotent, mit Fehlerprotokoll',
    'Test-Datei: Daten/kfz-kaufmann-test.mdb'
  ]}
/>
