<script setup lang="ts">
/**
 * Die Kopfzeile: Seitentitel, Benutzermenü, auf dem Telefon der Griff zur
 * Schublade.
 *
 * Der Ladebalken sitzt in `app.vue` und überlagert diese Leiste, ohne Platz im
 * Fluss zu belegen — sonst würde die Seite bei jeder Anfrage springen.
 */
defineProps<{ title: string }>()

const emit = defineEmits<{ openNavigation: [] }>()
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center gap-2 border-b border-default bg-default px-4"
    data-testid="app-header"
  >
    <UButton
      class="lg:hidden"
      color="neutral"
      variant="ghost"
      icon="i-lucide-menu"
      aria-label="Navigation öffnen"
      data-testid="open-navigation"
      @click="emit('openNavigation')"
    />

    <h1
      class="truncate text-base font-semibold"
      data-testid="page-title"
    >
      {{ title }}
    </h1>

    <div class="grow" />

    <AppUserMenu />
  </header>
</template>
