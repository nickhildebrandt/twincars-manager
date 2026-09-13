<script setup lang="ts">
import { de } from '@nuxt/ui/locale'

useHead({ title: 'TwinCarsManager' })
</script>

<template>
  <!-- UApp provides the toaster, tooltip and overlay context. It is required. -->
  <UApp :locale="de">
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
