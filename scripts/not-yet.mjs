// Placeholder for pnpm scripts whose implementation arrives in a later work
// package (T-002 test stack, T-003 documentation, T-005 database). It exits 0
// so the pipeline stays green while the skeleton is being built, and it prints
// which package will replace it.
const OWNER = {
  'test': 'T-002',
  'test:unit': 'T-002',
  'test:nuxt': 'T-002',
  'test:integration': 'T-002',
  'test:browser': 'T-002',
  'test:e2e': 'T-002',
  'test:cov': 'T-002',
  'test:cov:update': 'T-002',
  'test:befunde': 'T-002',
  'test:db:reset': 'T-002',
  'docs:check': 'T-003',
  'docs:api': 'T-003',
  'docs:data': 'T-003',
  'db:generate': 'T-005',
  'db:migrate': 'T-005',
  'db:studio': 'T-005',
  'db:seed': 'T-005',
}

const name = process.argv[2] ?? '(unbekannt)'
const owner = OWNER[name] ?? '(unbekanntes Paket)'
console.log(`[noch nicht umgesetzt] "${name}" wird von Arbeitspaket ${owner} bereitgestellt.`)
console.log('Siehe docs/rewrite/06-arbeitsplan.md.')
