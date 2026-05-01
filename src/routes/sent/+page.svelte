<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Gesendet"
  subtitle="Versand-Historie aller E-Mails aus der App."
/>
<ComingSoon
  features={[
    'Filter nach Typ, Status, Empfänger',
    'Wiederversand mit ausdrücklicher Bestätigung',
    'PDF-Vorschau des Versands'
  ]}
/>
