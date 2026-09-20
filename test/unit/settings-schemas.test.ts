/**
 * Die Schemata des Assistenten und der Einstellungen (T-010).
 *
 * Sie sind die **erste** Prüfschicht (P-28): Feldform und Zusammenhang
 * innerhalb eines Formulars. Was gegen den Bestand läuft — etwa ob ein
 * Startwert über den Altnummern liegt — gehört in die dritte Schicht und
 * steht nicht hier.
 *
 * Geprüft wird jedes Feld dreifach: gültig, an der Grenze, ungültig samt
 * deutscher Meldung.
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  GERMAN_STATES,
  companyProfileSchema,
  companyTaxSchema,
  documentDefaultsSchema,
  numberRangeSchema,
  numberTemplateSchema,
  securitySettingsSchema,
  smtpSchema,
  vatRateSchema,
  workshopHoursSchema,
  workshopWeekSchema,
} from '#shared/schemas/settings'

/** Die erste Meldung eines gescheiterten Durchgangs. */
function reject<T extends v.GenericSchema>(schema: T, input: unknown): string {
  const result = v.safeParse(schema, input, { abortPipeEarly: false })
  expect(result.success, `Erwartet wurde eine Abweisung von ${JSON.stringify(input)}`).toBe(false)
  return result.issues?.[0]?.message ?? ''
}

/* ── Firmendaten ───────────────────────────────────────────────────────── */

const PROFILE = {
  companyName: 'Autohaus Muster GmbH',
  street: 'Hauptstraße 1',
  zip: '89073',
  city: 'Ulm',
  state: 'Baden-Württemberg',
  phone: '0731 123456',
  email: 'info@muster.de',
}

describe('Firmendaten', () => {
  it('nimmt die Pflichtangaben an', () => {
    expect(v.parse(companyProfileSchema, PROFILE).companyName).toBe('Autohaus Muster GmbH')
  })

  it('verlangt den Firmennamen', () => {
    expect(reject(companyProfileSchema, { ...PROFILE, companyName: '  ' }))
      .toBe('Bitte den Firmennamen eingeben.')
  })

  it('verlangt eine Anschrift', () => {
    expect(reject(companyProfileSchema, { ...PROFILE, street: '' }))
      .toBe('Bitte die Straße mit Hausnummer eingeben.')
  })

  it('kennt genau die sechzehn Bundesländer', () => {
    // Als Liste und nicht als Freitext: das Land steht auf dem Briefkopf.
    expect(GERMAN_STATES).toHaveLength(16)
    expect(GERMAN_STATES).toContain('Nordrhein-Westfalen')
    expect(reject(companyProfileSchema, { ...PROFILE, state: 'Tirol' }))
      .toBe('Bitte ein Bundesland wählen.')
  })

  it('weist eine unbrauchbare E-Mail ab', () => {
    expect(reject(companyProfileSchema, { ...PROFILE, email: 'info@' })).toBeTruthy()
  })

  it('lässt Mobil, Fax und Web weg', () => {
    const parsed = v.parse(companyProfileSchema, PROFILE)
    expect(parsed.mobile).toBeUndefined()
    expect(parsed.website).toBeUndefined()
  })
})

/* ── Steuer und Bank ───────────────────────────────────────────────────── */

describe('Steuer und Bank', () => {
  const TAX = { taxNumber: '88/123/45678' }

  it('verlangt die Steuernummer', () => {
    expect(reject(companyTaxSchema, { taxNumber: '' }))
      .toBe('Bitte die Steuernummer eingeben.')
  })

  it('setzt ohne Angabe 19 % und keine §19-Regelung', () => {
    const parsed = v.parse(companyTaxSchema, TAX)
    expect(parsed.defaultVatRate).toBe(19)
    expect(parsed.smallBusinessExempt).toBe(false)
  })

  it('nimmt 16 % an — der Satz, den der Altbestand kennt', () => {
    // 207 Rechnungen im Kfz-Kaufmann-Export stehen auf 16 % (M-44). Ein
    // fester Satz im Code hätte die nie abbilden können.
    expect(v.parse(companyTaxSchema, { ...TAX, defaultVatRate: 16 }).defaultVatRate).toBe(16)
  })

  it('nimmt einen Satz mit Komma an, wie ihn jemand tippt', () => {
    expect(v.parse(vatRateSchema, '7,5')).toBe(7.5)
    expect(v.parse(vatRateSchema, '19')).toBe(19)
  })

  it('hält die Grenzen des Steuersatzes ein', () => {
    expect(v.parse(vatRateSchema, 0)).toBe(0)
    expect(v.parse(vatRateSchema, 100)).toBe(100)
    expect(reject(vatRateSchema, -1)).toBe('Der Steuersatz darf nicht negativ sein.')
    expect(reject(vatRateSchema, 101)).toBe('Der Steuersatz darf höchstens 100 % betragen.')
  })

  it('prüft die IBAN, wenn eine dasteht', () => {
    expect(reject(companyTaxSchema, { ...TAX, iban: 'DE00 1234' })).toBeTruthy()
  })

  it('lässt die USt-IdNr. ohne Formatprüfung durch', () => {
    // Die Formate der EU sind zu verschieden, um sie hier zu erraten.
    expect(v.parse(companyTaxSchema, { ...TAX, vatId: 'ATU12345678' }).vatId)
      .toBe('ATU12345678')
  })
})

/* ── Nummernkreise ─────────────────────────────────────────────────────── */

describe('Die Nummernvorlage', () => {
  it.each([
    'RE-{YYYY}-{NNNN}',
    'KV-{YY}{MM}-{NNN}',
    '{N}',
    'K-{NNNNN}',
  ])('nimmt %s an', (template) => {
    expect(v.parse(numberTemplateSchema, template)).toBe(template)
  })

  it('verlangt einen Zähler', () => {
    // Ohne `{N}` bekäme jeder Beleg dieselbe Nummer — und der eindeutige
    // Index ließe den zweiten nicht zu. Ein Fehler beim Ausstellen statt
    // beim Einrichten.
    expect(reject(numberTemplateSchema, 'RE-{YYYY}'))
      .toBe('Die Vorlage braucht einen Zähler, zum Beispiel {NNNN}.')
  })

  it('weist einen unbekannten Platzhalter ab', () => {
    expect(reject(numberTemplateSchema, 'RE-{JAHR}-{NNNN}'))
      .toContain('unbekannten Platzhalter')
    expect(reject(numberTemplateSchema, 'RE-{DD}-{NNNN}'))
      .toContain('unbekannten Platzhalter')
  })

  it('verlangt überhaupt eine Vorlage', () => {
    expect(reject(numberTemplateSchema, '   ')).toBe('Bitte eine Vorlage eingeben.')
  })
})

describe('Der Nummernkreis', () => {
  const RANGE = { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 1 }

  it('nimmt einen Startwert oberhalb der Altnummern an', () => {
    // Der Altbestand läuft bis 20090446 (M-44). Der neue Kreis darf ein
    // eigenes Schema haben, muss aber in sich lückenlos sein.
    expect(v.parse(numberRangeSchema, { ...RANGE, nextValue: 20_090_447 }).nextValue)
      .toBe(20_090_447)
  })

  it('nimmt den Startwert auch als Zeichenkette, wie er aus dem Formular kommt', () => {
    expect(v.parse(numberRangeSchema, { ...RANGE, nextValue: '42' }).nextValue).toBe(42)
  })

  it('beginnt bei 1', () => {
    expect(reject(numberRangeSchema, { ...RANGE, nextValue: 0 }))
      .toBe('Der Startwert beginnt bei 1.')
  })

  it('weist eine unbekannte Nummernart ab', () => {
    expect(reject(numberRangeSchema, { ...RANGE, kind: 'lieferschein' }))
      .toBe('Unbekannte Nummernart.')
  })
})

/* ── Belegvorgaben ─────────────────────────────────────────────────────── */

describe('Belegvorgaben', () => {
  it('setzt ohne Angabe Sie, 14 Tage und keine Kreise', () => {
    const parsed = v.parse(documentDefaultsSchema, {})
    expect(parsed.salutationStyle).toBe('Sie')
    expect(parsed.defaultPaymentTermDays).toBe(14)
    expect(parsed.numberRanges).toEqual([])
  })

  it('lässt ein Zahlungsziel von null zu — sofort fällig', () => {
    expect(v.parse(documentDefaultsSchema, { defaultPaymentTermDays: 0 })
      .defaultPaymentTermDays).toBe(0)
  })

  it('weist ein Zahlungsziel über einem Jahr ab', () => {
    expect(reject(documentDefaultsSchema, { defaultPaymentTermDays: 366 }))
      .toContain('Vertipper')
  })

  it('nimmt den Stundensatz in Cent', () => {
    // Geld ist überall eine Ganzzahl in Cent (E-10).
    expect(v.parse(documentDefaultsSchema, { laborRate: 9500 }).laborRate).toBe(9500)
  })
})

/* ── Öffnungszeiten ────────────────────────────────────────────────────── */

describe('Öffnungszeiten', () => {
  const open = (weekday: number) => ({
    weekday, closed: false, opensAt: '08:00', closesAt: '17:00',
  })

  it('nimmt einen offenen Tag an', () => {
    expect(v.parse(workshopHoursSchema, open(1)).weekday).toBe(1)
  })

  it('verlangt, dass das Schließen nach dem Öffnen liegt', () => {
    expect(reject(workshopHoursSchema, { ...open(1), closesAt: '07:00' }))
      .toBe('Das Schließen muss nach dem Öffnen liegen.')
  })

  it('lässt einen geschlossenen Tag in Ruhe', () => {
    // An einem geschlossenen Tag stehen die Zeiten aus der Vorgabe. Sie zu
    // prüfen hielte jemanden auf, der gar nichts eingegeben hat.
    expect(v.parse(workshopHoursSchema, {
      weekday: 0, closed: true, opensAt: '17:00', closesAt: '08:00',
    }).closed).toBe(true)
  })

  it('zählt Sonntag als 0 und Samstag als 6 — wie die ganze Anwendung', () => {
    // Dieselbe Zählweise wie `businessWeekday()` und der Seed. Eine zweite
    // daneben hiesse, an jeder Stelle umzurechnen, an der geprüft wird, ob
    // gerade offen ist — und dort zeigt sich der Fehler als „montags
    // geschlossen".
    expect(v.parse(workshopHoursSchema, open(0)).weekday).toBe(0)
    expect(v.parse(workshopHoursSchema, open(6)).weekday).toBe(6)
    expect(reject(workshopHoursSchema, open(-1))).toBe('Wochentag außerhalb des Bereichs.')
    expect(reject(workshopHoursSchema, open(7))).toBe('Wochentag außerhalb des Bereichs.')
  })

  it('verlangt alle sieben Tage', () => {
    const week = [0, 1, 2, 3, 4, 5].map(open)
    expect(reject(workshopWeekSchema, week))
      .toBe('Es müssen alle sieben Wochentage angegeben sein.')
  })

  it('lässt keinen Tag doppelt zu', () => {
    const week = [0, 0, 1, 2, 3, 4, 5].map(open)
    expect(reject(workshopWeekSchema, week)).toBe('Jeder Wochentag darf nur einmal vorkommen.')
  })

  it('nimmt eine vollständige Woche an', () => {
    // Genau der Stand, den der Seed schreibt: Mo–Fr offen, Sa und So zu.
    const week = [1, 2, 3, 4, 5].map(open).concat(
      [0, 6].map(day => ({ weekday: day, closed: true, opensAt: '08:00', closesAt: '17:00' })),
    )
    expect(v.parse(workshopWeekSchema, week)).toHaveLength(7)
  })
})

/* ── SMTP ──────────────────────────────────────────────────────────────── */

describe('SMTP', () => {
  const SMTP = {
    host: 'mail.muster.de',
    port: 587,
    secure: 'STARTTLS',
    fromAddress: 'werkstatt@muster.de',
    fromName: 'Autohaus Muster',
  }

  it('nimmt eine vollständige Angabe an', () => {
    expect(v.parse(smtpSchema, SMTP).port).toBe(587)
  })

  it('nimmt den Port auch als Zeichenkette', () => {
    expect(v.parse(smtpSchema, { ...SMTP, port: '465' }).port).toBe(465)
  })

  it('hält die Portgrenzen ein', () => {
    expect(reject(smtpSchema, { ...SMTP, port: 0 }))
      .toBe('Die Portnummer liegt zwischen 1 und 65535.')
    expect(reject(smtpSchema, { ...SMTP, port: 65_536 }))
      .toBe('Die Portnummer liegt zwischen 1 und 65535.')
  })

  it('weist eine unbekannte Verschlüsselung ab', () => {
    expect(reject(smtpSchema, { ...SMTP, secure: 'SSLv3' }))
      .toBe('Unbekannte Verschlüsselung.')
  })

  it('lässt das Passwort weg — leer heißt „nicht ändern"', () => {
    expect(v.parse(smtpSchema, SMTP).password).toBeUndefined()
  })

  it('verlangt einen Absendernamen', () => {
    expect(reject(smtpSchema, { ...SMTP, fromName: '' }))
      .toBe('Bitte einen Absendernamen eingeben.')
  })
})

/* ── Zugang ────────────────────────────────────────────────────────────── */

describe('Zugang', () => {
  it('ist ohne Angaben in Ordnung — der sichere Bereich ist leer', () => {
    // Leer gelassen gilt die Sperre überall (P-22). Eine Ausnahme soll
    // jemand bewusst eintragen.
    expect(v.parse(securitySettingsSchema, {}).safeIpRanges).toBe('')
  })

  it('nimmt Adressen, Netze und Bereiche an', () => {
    const ranges = '192.168.1.0/24\n10.0.0.5\n192.168.2.10-50'
    expect(v.parse(securitySettingsSchema, { safeIpRanges: ranges }).safeIpRanges)
      .toBe(ranges)
  })

  it('weist einen Eintrag ab, den niemand versteht', () => {
    // Gespeichert wirkte er nie, und niemand merkte es — bis sich jemand
    // aussperrt.
    expect(reject(securitySettingsSchema, { safeIpRanges: 'internes Netz' }))
      .toContain('keine gültige Adresse')
  })

  it('prüft die Administrator-Adresse', () => {
    expect(reject(securitySettingsSchema, { adminEmail: 'chef@' })).toBeTruthy()
    expect(v.parse(securitySettingsSchema, { adminEmail: 'chef@muster.de' }).adminEmail)
      .toBe('chef@muster.de')
  })
})
