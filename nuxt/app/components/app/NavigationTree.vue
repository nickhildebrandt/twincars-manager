<script setup lang="ts">
/**
 * Die Einträge der Seitenleiste.
 *
 * Eigene Komponente, damit die Leiste am Rand und die Schublade auf dem Telefon
 * denselben Baum zeigen — der Vorgänger pflegte beide getrennt.
 */
import type { NavGroup } from '#shared/navigation'

const props = defineProps<{
  groups: NavGroup[]
  /** Der Pfad des aktiven Eintrags, oder nichts. */
  activePath?: string
}>()

const emit = defineEmits<{ navigate: [] }>()

const isActive = (to: string) => props.activePath === to
</script>

<template>
  <nav
    aria-label="Hauptnavigation"
    data-testid="navigation"
  >
    <div
      v-for="group in props.groups"
      :key="group.label"
      class="mb-4"
      data-testid="nav-group"
    >
      <p class="px-3 pb-1 text-xs font-medium text-dimmed uppercase">
        {{ group.label }}
      </p>

      <ul class="flex flex-col gap-0.5">
        <li
          v-for="item in group.items"
          :key="item.to"
        >
          <ULink
            :to="item.to"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
            :class="isActive(item.to)
              ? 'bg-elevated font-medium text-highlighted'
              : 'text-default hover:bg-elevated/50'"
            :data-testid="`nav-item-${item.to}`"
            @click="emit('navigate')"
          >
            <UIcon
              :name="item.icon"
              class="size-4 shrink-0"
            />
            <span class="truncate">{{ item.label }}</span>
          </ULink>
        </li>
      </ul>
    </div>
  </nav>
</template>
