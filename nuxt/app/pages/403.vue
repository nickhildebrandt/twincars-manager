<script setup lang="ts">
/**
 * Kein Zugriff.
 *
 * Der Vorgänger zeigte in diesem Fall eine leere Seite: die Navigation filterte
 * den Eintrag weg, aber wer den Link kannte, landete im Nichts. Hier steht,
 * was los ist und wie es weitergeht.
 */
useHead({ title: 'Kein Zugriff' })

const { user } = useAuth()
</script>

<template>
  <UContainer class="flex min-h-[60vh] items-center justify-center py-10">
    <UCard class="w-full max-w-md text-center">
      <template #header>
        <UIcon
          name="i-lucide-lock"
          class="size-8 text-warning"
        />
        <h1 class="mt-2 text-lg font-semibold">
          Kein Zugriff
        </h1>
      </template>

      <p
        class="text-muted"
        data-testid="forbidden-message"
      >
        Für diesen Bereich fehlt Ihnen die Berechtigung.
        <template v-if="user">
          Sie sind als <strong>{{ user.displayName }}</strong> angemeldet.
        </template>
        Wenden Sie sich an die Verwaltung, wenn Sie hier arbeiten sollen.
      </p>

      <template #footer>
        <UButton
          to="/"
          icon="i-lucide-house"
          data-testid="forbidden-home"
        >
          Zur Startseite
        </UButton>
      </template>
    </UCard>
  </UContainer>
</template>
