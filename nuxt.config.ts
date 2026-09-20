// Nuxt configuration for TwinCarsManager.
// Binding rules for this file live in ./docs/rewrite/03-architektur.md.
import { scheduledTasksConfig } from './server/tasks/_registry'

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
    origin: process.env.ORIGIN ?? '',
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? process.env.ORIGIN ?? '',
    // Only 'on' behind a proxy that overwrites x-forwarded-for. Left off, the
    // rate limiter counts the socket address, which nobody can forge (B-003).
    trustProxy: process.env.TRUST_PROXY ?? 'off',
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID ?? '',
      certId: process.env.EBAY_CERT_ID ?? '',
      ruName: process.env.EBAY_RU_NAME ?? '',
      env: process.env.EBAY_ENV ?? 'production',
      verificationToken: process.env.EBAY_VERIFICATION_TOKEN ?? '',
      deletionEndpointUrl: process.env.EBAY_DELETION_ENDPOINT_URL ?? '',
    },
    tasks: {
      // Recurring work runs on a schedule — weekdays 07:30 Europe/Berlin
      // (08-entscheidungen.md E-12). The "Jetzt prüfen" button triggers the
      // same task by hand. Set TASKS_SCHEDULE=off to silence the schedule
      // without touching the code, e.g. on a staging instance.
      scheduleEnabled: process.env.TASKS_SCHEDULE !== 'off',
    },
    public: {
      appVersion: '0.0.0-development',
      // Minutes of inactivity before the session ends. The browser needs this
      // value, so it is public — it is a duration, not a secret.
      idleTimeoutMinutes: Number(process.env.IDLE_TIMEOUT_MINUTES ?? 60),
    },
  },

  future: { compatibilityVersion: 4 },
  compatibilityDate: '2026-09-12',

  nitro: {
    preset: 'node-server',

    // Aufgaben sind in Nitro noch als experimentell geführt und werden ohne
    // diesen Schalter **gar nicht erst eingelesen**. Ohne ihn meldet der
    // Server beim Start „Scheduled task protokoll-rotieren is not defined!",
    // startet aber — und die Rotation lief nie. Eine Warnung im Anlauflog
    // liest nach der dritten Woche niemand mehr.
    experimental: { tasks: true },

    // Built from server/tasks/_registry.ts so schedule and implementation
    // cannot drift apart. Whether the schedule actually fires is decided at
    // runtime by runtimeConfig.tasks.scheduleEnabled.
    scheduledTasks: scheduledTasksConfig(),
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
