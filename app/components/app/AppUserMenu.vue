<script setup lang="ts">
/**
 * Wer angemeldet ist, und der Weg hinaus.
 */
const { user, signOut } = useAuth()
const notify = useNotify()

const initials = computed(() => {
  const name = user.value?.displayName ?? ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
})

const items = computed(() => [[
  {
    label: 'Abmelden',
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      await signOut()
      notify.info('Sie sind abgemeldet.')
    },
  },
]])
</script>

<template>
  <UDropdownMenu
    v-if="user"
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      trailing-icon="i-lucide-chevron-down"
      data-testid="user-menu"
      :aria-label="`Angemeldet als ${user.displayName}`"
    >
      <UAvatar
        :alt="user.displayName"
        :text="initials"
        size="2xs"
      />
      <span class="hidden max-w-40 truncate sm:inline">{{ user.displayName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
