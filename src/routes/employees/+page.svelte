<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Mitarbeiter"
  subtitle="Stammdaten inkl. Steuer, SV und Bankverbindung."
/>
<ComingSoon
  features={[
    'Komplette deutsche Lohn-Stammdaten',
    'Abwesenheiten Urlaub und Krankheit',
    'Verknüpfung in Lohnabrechnung'
  ]}
/>
