import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), svelteTesting()],
  ssr: { noExternal: ['daisyui'] },
  optimizeDeps: { exclude: ['@lucide/svelte'] },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/**/__fixtures__/**',
        'src/app.d.ts',
        'src/app.html',
        'src/hooks.ts',
        'src/lib/server/db/migrate.ts'
      ]
    }
  }
})
