<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ComingSoon from '$lib/components/ui/ComingSoon.svelte'
</script>

<PageHeader
  title="Einstellungen"
  subtitle="Vollständige Konfiguration der App."
/>
<ComingSoon
  features={[
    'Firmendaten, Bank, Steuern, Nummernkreise',
    'Mailvorlagen, PDF-Einstellungen, Verkaufsschild',
    'Lohn, Buchhaltung, SMTP',
    'Backup und Import'
  ]}
/>
