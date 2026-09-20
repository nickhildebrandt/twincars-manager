/**
 * Das Protokoll (M-01, M-39) und seine Rotation.
 *
 * Geprüft wird das, wovon ein Protokoll lebt: dass ein Speichervorgang
 * **einen** Eintrag erzeugt und nicht zwölf, dass unveränderte Felder
 * wegbleiben, dass Passwörter nie hineingeraten, dass der abgewiesene Zugriff
 * darin steht — und dass ein Fehler beim Schreiben den Vorgang nicht mitreißt.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { asc, desc, eq } from 'drizzle-orm'
import { installNitroGlobals } from '../setup/nitro-globals'

const config = installNitroGlobals()

const { auditLog, signInAttempts } = await import('../../server/database/schema/index.ts')
const {
  changesBetween,
  defaultSeverity,
  isLoggableField,
  record,
  recordChange,
  recordSecurity,
} = await import('../../server/utils/audit.ts')
const {
  ACCOUNTING_ENTITIES,
  RETENTION_DAYS,
  rotateAuditLog,
} = await import('../../server/utils/audit-rotation.ts')
const { openTestDatabase } = await import('../setup/drizzle')

const { db, close } = openTestDatabase()
afterAll(close)

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(signInAttempts)
})

const entries = () => db.select().from(auditLog).orderBy(asc(auditLog.at))
const latest = async () => (await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(1))[0]

const DAY = 24 * 60 * 60 * 1000

/** Schreibt einen Eintrag mit vorgegebenem Alter. */
async function aged(days: number, values: Record<string, unknown>) {
  await db.insert(auditLog).values({
    action: 'geaendert',
    at: new Date(Date.now() - days * DAY).toISOString(),
    ...values,
  } as never)
}

describe('changesBetween', () => {
  it('P-17: nennt nur die Felder, die sich wirklich geändert haben', () => {
    // Sonst ersäuft der eine geänderte Wert in vierzig gleichen.
    const changes = changesBetween(
      { lastName: 'Meier', city: 'Ulm', zip: '89073' },
      { lastName: 'Meier', city: 'Neu-Ulm', zip: '89231' },
    )
    expect(changes).toEqual([
      { field: 'city', before: 'Ulm', after: 'Neu-Ulm' },
      { field: 'zip', before: '89073', after: '89231' },
    ])
  })

  it('erkennt ein neu gesetztes und ein geleertes Feld', () => {
    expect(changesBetween({ phone: null }, { phone: '0731 1234' }))
      .toEqual([{ field: 'phone', before: null, after: '0731 1234' }])

    expect(changesBetween({ phone: '0731 1234' }, { phone: null }))
      .toEqual([{ field: 'phone', before: '0731 1234', after: null }])
  })

  it('hält `null`, `undefined` und Fehlen für dasselbe', () => {
    // Ein Formular schickt mal das eine, mal das andere. Für einen Menschen
    // steht da in allen drei Fällen nichts.
    expect(changesBetween({ notes: null }, {})).toEqual([])
    expect(changesBetween({}, { notes: undefined })).toEqual([])
  })

  it('vergleicht Listen und Objekte über ihren Inhalt', () => {
    expect(changesBetween({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toEqual([])
    expect(changesBetween({ tags: ['a'] }, { tags: ['a', 'b'] })).toHaveLength(1)
  })

  it('vergleicht ein Datum über seinen Wert, nicht über das Objekt', () => {
    const a = new Date('2026-03-01T10:00:00Z')
    const b = new Date('2026-03-01T10:00:00Z')
    expect(changesBetween({ at: a }, { at: b })).toEqual([])

    expect(changesBetween(
      { at: new Date('2026-03-01T10:00:00Z') },
      { at: new Date('2026-03-02T10:00:00Z') },
    )).toHaveLength(1)
  })

  it('erkennt den Wechsel von einem Datum auf eine Zeichenkette', () => {
    // Kommt vor, wenn eine Spalte von `timestamp` auf Text wechselt oder ein
    // Formular den Wert bereits umgewandelt hat.
    expect(changesBetween(
      { at: new Date('2026-03-01T10:00:00.000Z') },
      { at: '2026-03-01T10:00:00.000Z' },
    )).toEqual([])
  })

  it('kommt mit einem fehlenden Zustand zurecht', () => {
    expect(changesBetween(null, { lastName: 'Meier' })).toHaveLength(1)
    expect(changesBetween({ lastName: 'Meier' }, null)).toHaveLength(1)
    expect(changesBetween(null, null)).toEqual([])
  })
})

describe('Was nie ins Protokoll gehört', () => {
  it.each([
    'password',
    'passwordHash',
    'smtpPassword',
    'ebayAccessToken',
    'refreshToken',
    'apiToken',
    'sessionToken',
    'privateKey',
    'secret',
    'salt',
  ])('%s wird nicht protokolliert', (field) => {
    // Ein Protokoll, das Passwörter mitschreibt, ist selbst das Leck.
    expect(isLoggableField(field)).toBe(false)
  })

  it.each(['lastName', 'city', 'grossTotal', 'documentNumber', 'notes'])(
    '%s wird protokolliert',
    (field) => {
      expect(isLoggableField(field)).toBe(true)
    },
  )

  it('lässt ein verbotenes Feld schon beim Vergleichen weg', () => {
    // Nicht erst beim Schreiben: sonst stünde der alte Wert eines Passworts
    // kurzzeitig in einem Objekt, das irgendwohin gereicht wird.
    const changes = changesBetween(
      { lastName: 'Meier', passwordHash: 'alt' },
      { lastName: 'Schuster', passwordHash: 'neu' },
    )
    expect(changes.map(change => change.field)).toEqual(['lastName'])
  })

  it('lässt ein verbotenes Feld auch dann weg, wenn es hineingereicht wird', async () => {
    await record({
      action: 'geaendert',
      entity: 'users',
      entityId: 'u-1',
      changes: [
        { field: 'displayName', before: 'Anna', after: 'Anna C.' },
        { field: 'passwordHash', before: 'alt', after: 'neu' },
      ],
    }, undefined, db)

    const entry = await latest()
    expect(entry?.changes.map(change => change.field)).toEqual(['displayName'])
  })
})

describe('recordChange', () => {
  it('P-17: erzeugt genau einen Eintrag für zwei geänderte Felder', async () => {
    // „Am 4. März hat Anna die Anschrift und die Telefonnummer geändert" ist
    // eine Auskunft. Zwei Zeilen mit derselben Sekunde sind es nicht.
    await recordChange({
      entity: 'customers',
      entityId: 'k-1',
      action: 'geaendert',
      before: { city: 'Ulm', phone: null, lastName: 'Meier' },
      after: { city: 'Neu-Ulm', phone: '0731 1234', lastName: 'Meier' },
    }, undefined, db)

    const rows = await entries()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.changes).toHaveLength(2)
    expect(rows[0]?.changes.map(change => change.field)).toEqual(['city', 'phone'])
  })

  it('schreibt nichts, wenn sich nichts geändert hat', async () => {
    // Ein Speichern ohne Änderung ist kein Ereignis.
    await recordChange({
      entity: 'customers',
      entityId: 'k-1',
      action: 'geaendert',
      before: { city: 'Ulm' },
      after: { city: 'Ulm' },
    }, undefined, db)

    expect(await entries()).toHaveLength(0)
  })

  it('schreibt auch ohne Feldänderung, wenn es etwas zu sagen gibt', async () => {
    await recordChange({
      entity: 'documents',
      entityId: 'r-1',
      action: 'geaendert',
      before: { status: 'issued' },
      after: { status: 'issued' },
      note: 'PDF neu erzeugt',
    }, undefined, db)

    expect(await entries()).toHaveLength(1)
  })

  it('hält beim Anlegen den Anfangszustand fest', async () => {
    await recordChange({
      entity: 'customers',
      entityId: 'k-2',
      action: 'angelegt',
      after: { lastName: 'Schuster', city: 'Ulm' },
    }, undefined, db)

    const entry = await latest()
    expect(entry?.action).toBe('angelegt')
    expect(entry?.changes.every(change => change.before === null)).toBe(true)
  })

  it('gibt dem Löschen und dem Archivieren mehr Gewicht', async () => {
    expect(defaultSeverity('geloescht')).toBe('warnung')
    expect(defaultSeverity('archiviert')).toBe('warnung')
    expect(defaultSeverity('geaendert')).toBe('info')
    expect(defaultSeverity('angemeldet')).toBe('sicherheit')
    expect(defaultSeverity('abgewiesen')).toBe('sicherheit')
    expect(defaultSeverity('exportiert')).toBe('sicherheit')
  })
})

describe('P-18: Sicherheitsereignisse', () => {
  it('P-18: tragen ihr Gewicht, auch ohne Datensatz', async () => {
    await recordSecurity({
      action: 'abgewiesen',
      note: 'Zugriff ohne Berechtigung auf /api/ledger',
    }, undefined, db)

    const entry = await latest()
    expect(entry?.severity).toBe('sicherheit')
    expect(entry?.entity).toBeNull()
    expect(entry?.note).toContain('/api/ledger')
  })

  it('P-18: halten Adresse und Namen fest', async () => {
    await recordSecurity({
      action: 'gesperrt',
      entity: 'users',
      entityId: 'mmustermann',
      userName: 'mmustermann',
      clientAddress: '203.0.113.5',
      note: 'Konto nach zu vielen Fehlversuchen gesperrt',
    }, undefined, db)

    const entry = await latest()
    expect(entry?.clientAddress).toBe('203.0.113.5')
    expect(entry?.userName).toBe('mmustermann')
  })

  it('M-39: Änderung und Sicherheitsereignis stehen in derselben Tabelle', async () => {
    // Ein Protokoll, nicht zwei. Wer wissen will, was am Dienstagnachmittag
    // geschah, soll an einer Stelle nachsehen — unterschieden wird durch das
    // Gewicht, nicht durch den Ort.
    await recordChange({
      entity: 'customers',
      entityId: 'k-1',
      action: 'geaendert',
      before: { city: 'Ulm' },
      after: { city: 'Neu-Ulm' },
    }, undefined, db)
    await recordSecurity({
      action: 'abgewiesen',
      note: 'Zugriff ohne Berechtigung auf /api/ledger',
    }, undefined, db)

    const rows = await entries()
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.severity).sort()).toEqual(['info', 'sicherheit'])
  })

  it('P-18: lassen sich in einem Zug herausfiltern', async () => {
    // Die zweite häufige Abfrage: „zeig mir nur die Sicherheitsereignisse".
    await recordChange({
      entity: 'customers',
      entityId: 'k-1',
      action: 'angelegt',
      after: { lastName: 'Meier' },
    }, undefined, db)
    await recordSecurity({ action: 'angemeldet', note: 'Anmeldung' }, undefined, db)

    const security = await db.select().from(auditLog)
      .where(eq(auditLog.severity, 'sicherheit'))
    expect(security).toHaveLength(1)
  })
})

describe('P-19: das Protokoll wird nie geändert', () => {
  it('P-19: der Protokolldienst kennt kein Ändern und kein Löschen', async () => {
    // Ein Protokoll, das sich bearbeiten lässt, ist kein Beweis. Die einzige
    // Ausnahme ist die Rotation, und die steht woanders.
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      fileURLToPath(new URL('../../server/utils/audit.ts', import.meta.url)),
      'utf8',
    )
    expect(source).not.toMatch(/\.update\(/)
    expect(source).not.toMatch(/\.delete\(/)
  })

  it('P-19: kein Dienst und kein Endpoint ändert das Protokoll', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')

    const root = fileURLToPath(new URL('../../server', import.meta.url))
    const rotation = 'audit-rotation.ts'

    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (entry.endsWith('.ts')) files.push(full)
      }
    }
    walk(root)

    for (const file of files) {
      if (file.endsWith(rotation)) continue
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} ändert das Protokoll`).not.toMatch(/update\(auditLog\)/)
      expect(source, `${file} löscht aus dem Protokoll`).not.toMatch(/delete\(auditLog\)/)
    }
  })
})

describe('Protokollieren hält nichts auf', () => {
  it('ein Fehler beim Schreiben reißt den Vorgang nicht mit', async () => {
    // Ein volles Protokoll darf niemanden an der Arbeit hindern.
    const broken = {
      insert: () => {
        throw new Error('Protokoll kaputt')
      },
    }
    await expect(record(
      { action: 'geaendert', entity: 'customers', entityId: 'k-1' },
      undefined,
      broken as never,
    )).resolves.toBeUndefined()
  })
})

describe('P-20: die Rotation', () => {
  it('P-20: hält die drei Fristen ein', async () => {
    await aged(RETENTION_DAYS.standard + 1, { entity: 'customers', entityId: 'k-1' })
    await aged(RETENTION_DAYS.standard - 1, { entity: 'customers', entityId: 'k-2' })
    await aged(RETENTION_DAYS.sicherheit + 1, {
      entity: 'users', entityId: 'u-1', severity: 'sicherheit', action: 'angemeldet',
    })
    await aged(RETENTION_DAYS.sicherheit - 1, {
      entity: 'users', entityId: 'u-2', severity: 'sicherheit', action: 'angemeldet',
    })
    await aged(RETENTION_DAYS.standard + 1, { entity: 'documents', entityId: 'r-1' })

    const result = await rotateAuditLog(new Date(), db)

    const left = (await entries()).map(row => row.entityId)
    expect(left).toContain('k-2')
    expect(left).toContain('u-2')
    // Buchhaltungsnahes bleibt auch nach über einem Jahr.
    expect(left).toContain('r-1')
    expect(left).not.toContain('k-1')
    expect(left).not.toContain('u-1')
    expect(result.standard).toBe(1)
    expect(result.sicherheit).toBe(1)
  })

  it('P-20: entfernt Buchhaltungsnahes erst nach zehn Jahren', async () => {
    await aged(RETENTION_DAYS.buchhaltung + 1, { entity: 'documents', entityId: 'r-alt' })
    await aged(RETENTION_DAYS.buchhaltung - 1, { entity: 'documents', entityId: 'r-jung' })

    await rotateAuditLog(new Date(), db)

    const left = (await entries()).map(row => row.entityId)
    expect(left).toEqual(['r-jung'])
  })

  it('P-20: die längste Frist gewinnt', async () => {
    // Ein Sicherheitsereignis an einem Beleg bleibt zehn Jahre, nicht zwei.
    await aged(RETENTION_DAYS.sicherheit + 1, {
      entity: 'documents', entityId: 'r-2', severity: 'sicherheit', action: 'exportiert',
    })

    await rotateAuditLog(new Date(), db)
    expect((await entries()).map(row => row.entityId)).toEqual(['r-2'])
  })

  it('P-20: räumt auch den Zähler der Anmeldeversuche auf', async () => {
    await db.insert(signInAttempts).values([
      {
        username: 'alt',
        succeeded: false,
        at: new Date(Date.now() - (RETENTION_DAYS.anmeldeversuche + 1) * DAY).toISOString(),
      },
      { username: 'neu', succeeded: false },
    ])

    const result = await rotateAuditLog(new Date(), db)
    expect(result.anmeldeversuche).toBe(1)

    const left = await db.select().from(signInAttempts)
    expect(left.map(row => row.username)).toEqual(['neu'])
  })

  it('P-20: ist wiederholbar', async () => {
    // Eine Aufgabe mit Zeitplan wird irgendwann zweimal gestartet.
    await aged(RETENTION_DAYS.standard + 1, { entity: 'customers', entityId: 'k-1' })

    const first = await rotateAuditLog(new Date(), db)
    const second = await rotateAuditLog(new Date(), db)

    expect(first.standard).toBe(1)
    expect(second.standard).toBe(0)
    expect(second.sicherheit).toBe(0)
  })

  it('P-20: meldet, wie weit das Protokoll noch zurückreicht', async () => {
    await aged(30, { entity: 'customers', entityId: 'k-1' })
    const result = await rotateAuditLog(new Date(), db)
    expect(result.oldestRemaining).toBeTruthy()
  })

  it('P-20: lässt einen Eintrag ohne Datensatz nicht ewig stehen', async () => {
    await aged(RETENTION_DAYS.standard + 1, { entity: null, entityId: null })
    await rotateAuditLog(new Date(), db)
    expect(await entries()).toHaveLength(0)
  })

  it('P-20: die Liste der buchhaltungsnahen Tabellen ist nicht leer', () => {
    // Eine leere Liste hieße: alles wird nach einem Jahr gelöscht, auch die
    // Belege. Das fiele erst in zehn Jahren auf.
    expect(ACCOUNTING_ENTITIES.length).toBeGreaterThan(5)
    expect(ACCOUNTING_ENTITIES).toContain('documents')
    expect(ACCOUNTING_ENTITIES).toContain('ledger_entries')
  })
})

describe('Wer gehandelt hat', () => {
  it('nimmt Person und Adresse aus dem Ereignis', async () => {
    config.trustProxy = 'on'
    try {
      const event = {
        context: {
          auth: { userId: 'u-9', username: 'chefin', displayName: 'Anna Chefin' },
        },
        node: { req: { headers: { 'x-forwarded-for': '203.0.113.9' }, socket: {} } },
      }

      await record({ action: 'geaendert', entity: 'customers', entityId: 'k-1' }, event as never, db)

      const entry = await latest()
      expect(entry?.userId).toBe('u-9')
      expect(entry?.userName).toBe('Anna Chefin')
      expect(entry?.clientAddress).toBe('203.0.113.9')
    }
    finally {
      config.trustProxy = 'off'
    }
  })

  it('M-01: der eingefrorene Name überlebt den gelöschten Benutzer', async () => {
    // Deshalb ist der Verweis auf den Benutzer **kein** Fremdschlüssel: mit
    // ihm verschwände die Spur seiner Änderungen.
    await record({
      action: 'geaendert',
      entity: 'customers',
      entityId: 'k-1',
      userId: 'gibt-es-nicht-mehr',
      userName: 'Bernd Ausgeschieden',
    }, undefined, db)

    const entry = await latest()
    expect(entry?.userName).toBe('Bernd Ausgeschieden')
  })

  it('kommt auch ohne angemeldete Person zurecht', async () => {
    // Eine nächtliche Aufgabe hat keinen Benutzer.
    await record({ action: 'ausgefuehrt', entity: 'audit_log' }, undefined, db)

    const entry = await latest()
    expect(entry?.userId).toBeNull()
    expect(entry?.userName).toBeNull()
  })
})

describe('Die nächtliche Aufgabe', () => {
  it('P-20: räumt auf und hinterlässt selbst eine Spur', async () => {
    // Sonst wäre ausgerechnet die Aufgabe, die Spuren beseitigt, die einzige
    // ohne Spur.
    const task = (await import('../../server/tasks/protokoll-rotieren.ts')).default
    await aged(RETENTION_DAYS.standard + 1, { entity: 'customers', entityId: 'k-alt' })

    await task.run({} as never)

    const rows = await entries()
    expect(rows.map(row => row.entityId)).not.toContain('k-alt')

    const own = rows.find(row => row.action === 'ausgefuehrt')
    expect(own?.entity).toBe('audit_log')
    expect(own?.note).toContain('Protokoll rotiert')
    expect(own?.severity).toBe('warnung')
  })

  it('P-20: meldet einen leeren Lauf als gewöhnlich, nicht als auffällig', async () => {
    const task = (await import('../../server/tasks/protokoll-rotieren.ts')).default
    await task.run({} as never)

    const own = (await entries()).find(row => row.action === 'ausgefuehrt')
    expect(own?.severity).toBe('info')
  })

  it('P-20: steht mit Zeitplan im Aufgabenregister', async () => {
    const { TASKS, isTaskName } = await import('../../server/tasks/_registry.ts')
    const task = TASKS.find(entry => entry.name === 'protokoll-rotieren')
    expect(task).toBeDefined()
    expect(task?.cron).toBe('10 3 * * *')
    expect(isTaskName('protokoll-rotieren')).toBe(true)
  })
})
