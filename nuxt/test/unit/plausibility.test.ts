/**
 * Die dritte Prüfschicht (P-28).
 *
 * Feldprüfung sagt „das ist eine Zahl". Formularprüfung sagt „Ende nach
 * Beginn". Diese Schicht sagt „das passt nicht zu dem, was schon dasteht" —
 * und sie muss dabei genauso aussehen wie die beiden anderen, sonst merkt der
 * Nutzer, welche Schicht ihn aufgehalten hat.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  checkPlausibility,
  endsAfterStart,
  notBefore,
  notBlank,
  notLowerThan,
  rule,
  withinRange,
  withinYears,
} from '../../server/utils/plausibility'

type Form = { mileageKm: number | null, from: string | null, until: string | null }

describe('checkPlausibility', () => {
  it('lässt durch, was in Ordnung ist', async () => {
    await expect(checkPlausibility([
      rule<Form>({ field: 'mileageKm', message: 'zu klein', ok: form => (form.mileageKm ?? 0) > 0 }),
    ], { mileageKm: 10, from: null, until: null })).resolves.toBeUndefined()
  })

  it('P-28: wirft einen 422 mit Feldfehler — wie die beiden anderen Schichten', async () => {
    // Derselbe Ausgang wie bei Valibot: das Formular zeigt den Satz am Feld an.
    await expect(checkPlausibility([
      rule<Form>({
        field: 'mileageKm',
        message: 'Der Kilometerstand darf nicht sinken.',
        ok: () => false,
      }),
    ], { mileageKm: 10, from: null, until: null })).rejects.toMatchObject({
      statusCode: 422,
      data: { fields: { mileageKm: 'Der Kilometerstand darf nicht sinken.' } },
    })
  })

  it('sammelt alle Fehler und wirft einmal', async () => {
    // Wer drei Felder falsch ausgefüllt hat, soll das in einem Durchgang
    // erfahren und nicht dreimal hintereinander speichern müssen.
    await expect(checkPlausibility([
      rule<Form>({ field: 'mileageKm', message: 'a', ok: () => false }),
      rule<Form>({ field: 'from', message: 'b', ok: () => false }),
      rule<Form>({ field: 'until', message: 'c', ok: () => false }),
    ], { mileageKm: null, from: null, until: null })).rejects.toMatchObject({
      data: { fields: { mileageKm: 'a', from: 'b', until: 'c' } },
    })
  })

  it('zeigt je Feld nur den ersten Fehler', async () => {
    await expect(checkPlausibility([
      rule<Form>({ field: 'mileageKm', message: 'zuerst', ok: () => false }),
      rule<Form>({ field: 'mileageKm', message: 'danach', ok: () => false }),
    ], { mileageKm: null, from: null, until: null })).rejects.toMatchObject({
      data: { fields: { mileageKm: 'zuerst' } },
    })
  })

  it('überspringt eine Regel, die gerade nicht gilt', async () => {
    const ok = vi.fn(() => false)
    await expect(checkPlausibility([
      rule<Form>({ field: 'mileageKm', message: 'x', ok, when: () => false }),
    ], { mileageKm: null, from: null, until: null })).resolves.toBeUndefined()

    // Nicht nur „kein Fehler" — die Prüfung darf gar nicht erst laufen. Sonst
    // fragte sie die Datenbank nach etwas, das es in diesem Fall nicht gibt.
    expect(ok).not.toHaveBeenCalled()
  })

  it('wartet auf eine Prüfung, die die Datenbank fragt', async () => {
    const ok = vi.fn(async () => false)
    await expect(checkPlausibility([
      rule<Form>({ field: 'mileageKm', message: 'aus der Datenbank', ok }),
    ], { mileageKm: null, from: null, until: null })).rejects.toMatchObject({
      data: { fields: { mileageKm: 'aus der Datenbank' } },
    })
  })

  it('baut den Satz aus dem Wert, wenn er ihn nennen soll', async () => {
    await expect(checkPlausibility([
      rule<Form>({
        field: 'mileageKm',
        message: form => `Zuletzt standen ${form.mileageKm} km im Buch.`,
        ok: () => false,
      }),
    ], { mileageKm: 120_000, from: null, until: null })).rejects.toMatchObject({
      data: { fields: { mileageKm: 'Zuletzt standen 120000 km im Buch.' } },
    })
  })

  it('ohne Regeln geschieht nichts', async () => {
    await expect(checkPlausibility([], { mileageKm: null, from: null, until: null }))
      .resolves.toBeUndefined()
  })
})

describe('withinYears', () => {
  const now = new Date('2026-09-20T12:00:00Z')

  it('lässt ein Datum innerhalb der Frist durch', () => {
    expect(withinYears('2027-01-01', 2, now)).toBe(true)
  })

  it('weist ein Datum jenseits der Frist ab', () => {
    // Ein Termin im Jahr 2226 ist kein Termin, sondern ein Vertipper.
    expect(withinYears('2226-01-01', 2, now)).toBe(false)
  })

  it('lässt ein leeres Feld in Ruhe', () => {
    expect(withinYears(null, 2, now)).toBe(true)
    expect(withinYears(undefined, 2, now)).toBe(true)
  })

  it('weist ein unlesbares Datum ab', () => {
    expect(withinYears('gestern', 2, now)).toBe(false)
  })

  it('lässt die Vergangenheit unberührt — dafür ist sie nicht da', () => {
    expect(withinYears('1998-01-01', 2, now)).toBe(true)
  })
})

describe('notBefore und endsAfterStart', () => {
  it('erlaubt gleich', () => {
    expect(notBefore('2026-03-01', '2026-03-01')).toBe(true)
    expect(endsAfterStart('2026-03-01', '2026-03-01')).toBe(true)
  })

  it('weist die verkehrte Reihenfolge ab', () => {
    expect(endsAfterStart('2026-03-10', '2026-03-01')).toBe(false)
  })

  it('lässt ein offenes Ende zu', () => {
    expect(endsAfterStart('2026-03-01', null)).toBe(true)
  })
})

describe('notLowerThan', () => {
  it('lässt steigen und gleichbleiben zu', () => {
    expect(notLowerThan(120_000, 120_000)).toBe(true)
    expect(notLowerThan(130_000, 120_000)).toBe(true)
  })

  it('weist ein Sinken ab', () => {
    // Ein Tachostand, der sinkt, ist entweder ein Vertipper oder ein Fall für
    // die Staatsanwaltschaft. Beides gehört gemeldet.
    expect(notLowerThan(90_000, 120_000)).toBe(false)
  })

  it('lässt durch, wenn es noch keinen Vorwert gibt', () => {
    expect(notLowerThan(90_000, null)).toBe(true)
  })

  it('lässt ein leeres Feld in Ruhe', () => {
    expect(notLowerThan(null, 120_000)).toBe(true)
  })

  it('behandelt die Null als Wert, nicht als Leere', () => {
    expect(notLowerThan(0, 120_000)).toBe(false)
    expect(notLowerThan(10, 0)).toBe(true)
  })
})

describe('withinRange', () => {
  it('lässt die Grenzen selbst zu', () => {
    expect(withinRange(0, 0, 2_000_000)).toBe(true)
    expect(withinRange(2_000_000, 0, 2_000_000)).toBe(true)
  })

  it('weist darüber und darunter ab', () => {
    expect(withinRange(-1, 0, 2_000_000)).toBe(false)
    expect(withinRange(2_000_001, 0, 2_000_000)).toBe(false)
  })

  it('lässt ein leeres Feld in Ruhe', () => {
    expect(withinRange(null, 0, 10)).toBe(true)
  })
})

describe('notBlank', () => {
  it('weist Leerzeichen ab', () => {
    expect(notBlank('   ')).toBe(false)
    expect(notBlank('\t\n')).toBe(false)
  })

  it('lässt Text durch', () => {
    expect(notBlank('Ulm')).toBe(true)
  })

  it('lässt ein fehlendes Feld in Ruhe — das prüft die Feldschicht', () => {
    expect(notBlank(null)).toBe(true)
    expect(notBlank(undefined)).toBe(true)
  })
})
