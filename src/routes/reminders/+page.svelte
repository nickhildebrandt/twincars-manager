<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Offene Rechnungen & Mahnungen"
  subtitle="Mahnstufen 1-3, automatisch errechnete Verzugstage und Mahngebühren."
/>
<ComingSoon
  features={[
    'Verzugstage und Mahnstufen automatisch errechnet',
    'Mahngebühr je Stufe konfigurierbar',
    'PDF-Mahnung erstellen und versenden',
    'OP-Liste exportieren'
  ]}
/>
