import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { svelteTesting } from '@testing-library/svelte/vite'
import { fileURLToPath } from 'node:url'

// Alias `@opentelemetry/api` to an inert shim. better-auth wraps every
// dispatch in `withSpan`, and Rollup's CJS interop can bundle the real
// package down to a `default`-only namespace (named `trace` undefined),
// which crashes every request in the production container. We don't run
// OpenTelemetry, so tracing becomes a deterministic no-op. See
// `src/lib/server/otel-noop.ts`.
const otelNoop = fileURLToPath(
  new URL('./src/lib/server/otel-noop.ts', import.meta.url)
)

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), svelteTesting()],
  resolve: { alias: { '@opentelemetry/api': otelNoop } },
  ssr: { noExternal: ['daisyui'] },
  optimizeDeps: { exclude: ['@lucide/svelte'] },
  build: { target: 'esnext' },
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
