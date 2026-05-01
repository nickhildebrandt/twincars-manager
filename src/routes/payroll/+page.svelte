<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Lohn und Gehalt"
  subtitle="Lohnabrechnungen je Mitarbeiter und Periode."
/>
<ComingSoon
  features={[
    'Brutto/Netto mit AG-Anteilen',
    'Lohnzettel-PDF im deutschen Standard',
    'Automatischer E-Mail-Versand an Mitarbeiter'
  ]}
/>
