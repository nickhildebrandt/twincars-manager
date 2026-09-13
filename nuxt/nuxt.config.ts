// Nuxt configuration for TwinCarsManager.
// Binding rules for this file live in ../docs/rewrite/03-architektur.md.
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint'],

  // Server-side rendering is on for every route; the application is entirely
  // session-bound, so nothing is prerendered.
  ssr: true,

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      titleTemplate: '%s · TwinCarsManager',
    },
    // Values must match 04-ux.md §3.2. Reduced motion is honoured in main.css.
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
  },

  // The single stylesheet of the whole application. Adding a second one, or a
  // <style> block in a component, is a rule violation (03-architektur.md §8.1).
  css: ['~/assets/css/main.css'],

  // Secrets stay server-side. Everything readable by the browser goes into
  // `public` and must never contain a credential.
  // The values are mapped from the plain variable names the deployment uses
  // (DATABASE_URL, APP_SECRET …) rather than Nuxt's NUXT_-prefixed defaults.
  // This file is the ONLY place that reads process.env; everything else goes
  // through useRuntimeConfig().
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL ?? '',
    appSecret: process.env.APP_SECRET ?? '',
    appEncryptionKey: process.env.APP_ENCRYPTION_KEY ?? '',
    apiTokens: process.env.API_TOKENS ?? '',
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID ?? '',
      certId: process.env.EBAY_CERT_ID ?? '',
      ruName: process.env.EBAY_RU_NAME ?? '',
      env: process.env.EBAY_ENV ?? 'production',
      verificationToken: process.env.EBAY_VERIFICATION_TOKEN ?? '',
      deletionEndpointUrl: process.env.EBAY_DELETION_ENDPOINT_URL ?? '',
    },
    tasks: {
      // Recurring work is operator-triggered by default (08-entscheidungen.md
      // E-03). Turning this on is an operations decision.
      scheduleEnabled: false,
    },
    public: {
      appVersion: '0.0.0-development',
    },
  },

  future: { compatibilityVersion: 4 },
  compatibilityDate: '2026-09-12',

  nitro: {
    preset: 'node-server',
  },

  typescript: {
    typeCheck: false, // run explicitly via `pnpm typecheck`
    strict: true,
  },

  eslint: {
    config: {
      // ESLint formats this project. Prettier is not installed and must not be.
      //
      // `formatters: true` is deliberately NOT set: it pulls in
      // eslint-plugin-format, which depends on prettier. Stylistic covers
      // every file that holds code (js, ts, vue); markdown, json and yaml are
      // written by hand (08-entscheidungen.md E-21).
      stylistic: true,
    },
  },
})
