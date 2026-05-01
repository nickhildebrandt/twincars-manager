<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Lieferanten"
  subtitle="Lieferantenstamm mit Kontakt- und Bankdaten."
/>
<ComingSoon
  features={[
    'Suche, Filter, Pagination',
    'Verlinkung zu Artikeln',
    'Eingangsrechnungen aus Bestellungen'
  ]}
/>
