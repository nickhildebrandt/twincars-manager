/**
 * Test database maintenance.
 *
 *   node scripts/test-db.mjs reset     drop everything, rebuild the template
 *   node scripts/test-db.mjs drop      drop template + worker databases
 *   node scripts/test-db.mjs status    show what exists
 *
 * Rules: ../../docs/rewrite/05-teststrategie.md §3.
 */
import {
  TEMPLATE_DATABASE,
  adminSql,
  dropTemplateDatabase,
  dropWorkerDatabases,
  ensureTemplateDatabase,
  loadTestEnv,
} from '../test/setup/database-helpers.ts'

const command = process.argv[2] ?? 'status'
loadTestEnv()

const sql = adminSql()
try {
  if (command === 'drop' || command === 'reset') {
    const workers = await dropWorkerDatabases(sql)
    await dropTemplateDatabase(sql)
    console.log(`Verworfen: Vorlage + ${workers} Worker-Datenbank(en).`)
  }

  if (command === 'reset') {
    await ensureTemplateDatabase(sql)
    console.log(`Vorlage "${TEMPLATE_DATABASE}" neu gebaut.`)
  }

  if (command === 'status') {
    const rows = await sql`
      SELECT datname FROM pg_database
      WHERE datname LIKE 'twincars_test%' ORDER BY datname
    `
    console.log(rows.length === 0
      ? 'Keine Testdatenbanken vorhanden.'
      : rows.map(r => `  ${r.datname}`).join('\n'))
  }
}
finally {
  await sql.end({ timeout: 5 })
}
