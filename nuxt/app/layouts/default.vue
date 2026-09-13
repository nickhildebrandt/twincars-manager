<script setup lang="ts">
/**
 * Die Anwendungshülle: Seitenleiste links, Kopfzeile oben, Inhalt rechts.
 * Auf schmalen Geräten wird die Leiste zur Schublade.
 *
 * Stufe 3 der Ladeanzeige liegt **über dem Inhaltsbereich**, nicht über der
 * ganzen Seite: Navigation und Kopfzeile bleiben bedienbar, während etwas
 * lädt ([04-ux.md](../../../docs/rewrite/04-ux.md) §3.3).
 */
const { groups, current, title } = useNavigation()
const busy = useBusy()

const drawerOpen = ref(false)

// Die Schublade schließt sich nach jeder Navigation. Beim Vorgänger blieb sie
// offen, weil eine Checkbox den Zustand hielt und niemand sie zurücksetzte —
// jeder Wechsel kostete einen zusätzlichen Tipp (B-019).
const route = useRoute()
watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

// Der Dokumenttitel folgt der Seite. Beim Vorgänger stand überall dasselbe
// Wort, sodass sich Tabs und Verlauf nicht unterscheiden ließen (B-034).
useHead({ title })
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-default text-default">
    <AppSidebar
      class="hidden lg:flex"
      :groups="groups"
      :active-path="current?.to"
    />

    <USlideover
      v-model:open="drawerOpen"
      side="left"
      title="Navigation"
      :ui="{ content: 'w-64 max-w-[80vw]' }"
    >
      <template #body>
        <AppNavigationTree
          :groups="groups"
          :active-path="current?.to"
          @navigate="drawerOpen = false"
        />
      </template>
    </USlideover>

    <div class="flex min-w-0 grow flex-col">
      <AppHeader
        :title="title"
        @open-navigation="drawerOpen = true"
      />

      <main
        class="relative grow overflow-y-auto"
        :aria-busy="busy.slow.value"
        data-testid="content"
      >
        <slot />

        <!-- Stufe 3: sperrt den Inhalt, sobald es länger dauert. -->
        <Transition name="overlay">
          <div
            v-if="busy.slow.value"
            class="absolute inset-0 bg-default/60 backdrop-blur-[1px]"
            data-testid="busy-overlay"
          >
            <span class="sr-only">Wird geladen …</span>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>
