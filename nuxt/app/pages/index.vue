<script setup lang="ts">
useHead({ title: 'Start' })

const version = useRuntimeConfig().public.appVersion
</script>

<template>
  <UContainer class="py-10">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">
          TwinCarsManager
        </h1>
      </template>

      <p class="text-muted">
        Das Projektgerüst steht. Die fachlichen Module folgen nach dem
        Arbeitsplan in <code>docs/rewrite/06-arbeitsplan.md</code>.
      </p>

      <template #footer>
        <UBadge
          variant="subtle"
          color="neutral"
          data-testid="app-version"
        >
          Version {{ version }}
        </UBadge>
      </template>
    </UCard>
  </UContainer>
</template>
