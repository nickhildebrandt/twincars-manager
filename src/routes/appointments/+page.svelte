<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader title="Termine" subtitle="Termine direkt erfassen." />
<ComingSoon
  features={[
    'Mit Kunde und Fahrzeug verknüpft',
    'Im Kalender sichtbar',
    'Status: geplant, fertig, abgesagt'
  ]}
/>
