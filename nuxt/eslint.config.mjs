// ESLint is the only formatter in this project. Prettier is not installed and
// must not be added (../docs/rewrite/03-architektur.md §2.2).
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'twincars/ignores',
    ignores: [
      '.nuxt/**',
      '.output/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'server/database/migrations/**',
    ],
  },

  {
    name: 'twincars/rules',
    rules: {
      // A silently swallowed error is the one thing the operator never sees.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Environment access goes through runtimeConfig, validated once at boot
      // (03-architektur.md §10). The only exception is the env plugin itself.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Umgebungsvariablen nur über runtimeConfig lesen; validiert in server/plugins/00.env.ts.',
        },
      ],

      // Request input is read exclusively through the validating helpers in
      // server/utils/validate.ts so that every error has the same shape.
      'no-restricted-globals': [
        'error',
        {
          name: 'readBody',
          message: 'useValidatedBody(event, schema) benutzen.',
        },
        {
          name: 'getQuery',
          message: 'useValidatedQuery(event, schema) benutzen.',
        },
        {
          name: 'getRouterParams',
          message: 'useValidatedParams(event, schema) benutzen.',
        },
      ],
    },
  },

  {
    // Styling belongs in app.config.ts and main.css, never in a component.
    name: 'twincars/vue',
    files: ['**/*.vue'],
    rules: {
      'vue/block-order': ['error', { order: ['script', 'template'] }],
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    name: 'twincars/env-plugin-exception',
    files: ['server/plugins/00.env.ts', 'scripts/**', 'test/**', '*.config.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
)
