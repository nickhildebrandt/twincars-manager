<script setup lang="ts">
/**
 * Die Seitenleiste am linken Rand.
 *
 * Das Logo ist eine kleine Grafik, kein 1,1 MB großes PNG wie beim Vorgänger
 * (B-017) — hier reicht ein Schriftzug.
 */
import type { NavGroup } from '#shared/navigation'

defineProps<{
  groups: NavGroup[]
  activePath?: string
}>()

const emit = defineEmits<{ navigate: [] }>()

const version = useRuntimeConfig().public.appVersion
</script>

<template>
  <div
    class="flex h-full w-64 shrink-0 flex-col border-r border-default bg-elevated/40"
    data-testid="app-sidebar"
  >
    <ULink
      to="/"
      class="flex h-14 shrink-0 items-center gap-2 px-4 font-semibold"
      @click="emit('navigate')"
    >
      <UIcon
        name="i-lucide-car"
        class="size-5 text-primary"
      />
      TwinCarsManager
    </ULink>

    <div class="grow overflow-y-auto px-2 pb-4">
      <AppNavigationTree
        :groups="groups"
        :active-path="activePath"
        @navigate="emit('navigate')"
      />
    </div>

    <p
      class="shrink-0 px-4 py-2 text-xs text-dimmed"
      data-testid="app-version"
    >
      Version {{ version }}
    </p>
  </div>
</template>
