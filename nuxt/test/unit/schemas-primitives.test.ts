import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  bicSchema,
  citySchema,
  countSchema,
  dateSchema,
  emailSchema,
  hsnSchema,
  ibanSchema,
  idSchema,
  isRealDate,
  isValidIban,
  licensePlateSchema,
  MAX_MONEY_CENTS,
  moneySchema,
  notesSchema,
  optionalText,
  percentSchema,
  phoneSchema,
  positiveMoneySchema,
  quantitySchema,
  requiredText,
  searchSchema,
  text,
  timeSchema,
  tsnSchema,
  vinSchema,
  websiteSchema,
  zipSchema,
} from '#shared/schemas/primitives'
import '#shared/schemas/messages'

/** Parses and returns the output, or throws. */
const ok = <T extends v.GenericSchema>(schema: T, input: unknown) =>
  v.parse(schema, input) as v.InferOutput<T>

/** Returns the first message of a failed parse. */
function reject<T extends v.GenericSchema>(schema: T, input: unknown): string {
  const result = v.safeParse(schema, input)
  expect(result.success, `erwartete Ablehnung von ${JSON.stringify(input)}`).toBe(false)
  return result.success ? '' : result.issues[0]!.message
}

describe('idSchema', () => {
  it('nimmt eine UUID an', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    expect(ok(idSchema, uuid)).toBe(uuid)
  })

  it('lehnt eine Nicht-UUID mit deutscher Meldung ab', () => {
    expect(reject(idSchema, 'abc')).toBe('Ungültige Kennung.')
  })

  it('lehnt eine Zahl ab', () => {
    expect(reject(idSchema, 42)).toBe('Ungültige Kennung.')
  })
})

describe('text und requiredText', () => {
  it('schneidet Leerzeichen ab', () => {
    expect(ok(text(10), '  hallo  ')).toBe('hallo')
  })

  it('nimmt genau die Höchstlänge an', () => {
    expect(ok(text(5), 'abcde')).toBe('abcde')
  })

  it('lehnt ein Zeichen darüber ab', () => {
    expect(reject(text(5), 'abcdef')).toBe('Höchstens 5 Zeichen.')
  })

  it('lehnt leere Pflichttexte ab', () => {
    expect(reject(requiredText(10), '   ')).toBe('Pflichtfeld.')
  })

  it('nimmt einen einzelnen Buchstaben als Pflichttext an', () => {
    expect(ok(requiredText(10), 'a')).toBe('a')
  })
})

describe('emailSchema', () => {
  it.each([
    'nick@example.de',
    'vorname.nachname+tag@teil.example.com',
  ])('nimmt %s an', (value) => {
    expect(ok(emailSchema, value)).toBe(value)
  })

  it.each(['ohne-at', '@example.de', 'a@b', 'zwei@@example.de'])(
    'lehnt %s ab',
    (value) => {
      expect(reject(emailSchema, value)).toBe('Bitte eine gültige E-Mail-Adresse eingeben.')
    },
  )
})

describe('zipSchema', () => {
  it.each(['12345', '1234'])('nimmt %s an', (value) => {
    expect(ok(zipSchema, value)).toBe(value)
  })

  it.each(['123', '123456', '1234a'])('lehnt %s ab', (value) => {
    expect(reject(zipSchema, value)).toBe('Bitte eine gültige Postleitzahl eingeben.')
  })
})

describe('phoneSchema', () => {
  it.each(['+49 30 1234567', '030/123 45-67', ''])('nimmt %s an', (value) => {
    expect(ok(phoneSchema, value)).toBe(value.trim())
  })

  it('lehnt Buchstaben ab', () => {
    expect(reject(phoneSchema, '030 ABC')).toContain('Bitte nur Ziffern')
  })
})

describe('websiteSchema', () => {
  it.each(['https://twincast.de', 'twincast.de', 'http://www.a.co.uk'])(
    'nimmt %s an',
    (value) => {
      expect(ok(websiteSchema, value)).toBe(value)
    },
  )

  it('lehnt eine Adresse ohne Punkt ab', () => {
    expect(reject(websiteSchema, 'localhost')).toBe(
      'Bitte eine gültige Internetadresse eingeben.',
    )
  })
})

describe('ibanSchema', () => {
  it('nimmt eine gültige deutsche IBAN an und entfernt Leerzeichen', () => {
    expect(ok(ibanSchema, 'DE89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000')
  })

  it('macht Kleinbuchstaben groß', () => {
    expect(ok(ibanSchema, 'de89370400440532013000')).toBe('DE89370400440532013000')
  })

  it('lehnt eine falsche Prüfziffer ab', () => {
    expect(reject(ibanSchema, 'DE88370400440532013000')).toBe(
      'Die Prüfziffer der IBAN stimmt nicht.',
    )
  })

  it('lehnt eine zu kurze Zeichenfolge ab', () => {
    expect(reject(ibanSchema, 'DE89')).toBe('Bitte eine gültige IBAN eingeben.')
  })

  it('rechnet die Prüfziffer nach ISO 13616', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('GB82WEST12345698765432')).toBe(true)
    expect(isValidIban('DE89370400440532013001')).toBe(false)
  })
})

describe('bicSchema', () => {
  it.each(['COBADEFFXXX', 'COBADEFF'])('nimmt %s an', (value) => {
    expect(ok(bicSchema, value)).toBe(value)
  })

  it('lehnt einen zu kurzen BIC ab', () => {
    expect(reject(bicSchema, 'COBA')).toBe('Bitte einen gültigen BIC eingeben.')
  })
})

describe('Geldbeträge', () => {
  it('nimmt einen normalen Betrag in Cent an', () => {
    expect(ok(moneySchema, 123_456)).toBe(123_456)
  })

  it('nimmt einen negativen Betrag an (Gutschrift)', () => {
    expect(ok(moneySchema, -1000)).toBe(-1000)
  })

  it('nimmt die Null an', () => {
    expect(ok(positiveMoneySchema, 0)).toBe(0)
  })

  it('lehnt einen Bruchteil eines Cents ab', () => {
    expect(reject(moneySchema, 1234.5)).toBe('Beträge werden in ganzen Cent geführt.')
  })

  it('lehnt einen negativen Preis ab', () => {
    expect(reject(positiveMoneySchema, -1)).toBe('Darf nicht negativ sein.')
  })

  it('lehnt einen Betrag jenseits der Spaltenbreite ab', () => {
    expect(reject(moneySchema, MAX_MONEY_CENTS + 1)).toBe('Der Betrag ist unrealistisch groß.')
  })

  it('nimmt genau die Obergrenze an', () => {
    expect(ok(moneySchema, MAX_MONEY_CENTS)).toBe(MAX_MONEY_CENTS)
  })

  it('nimmt genau die Untergrenze an', () => {
    expect(ok(moneySchema, -MAX_MONEY_CENTS)).toBe(-MAX_MONEY_CENTS)
  })

  it('lehnt Text ab', () => {
    expect(reject(moneySchema, '12,50')).toBe('Bitte eine Zahl eingeben.')
  })
})

describe('percentSchema', () => {
  it.each([0, 19, 100])('nimmt %s an', (value) => {
    expect(ok(percentSchema, value)).toBe(value)
  })

  it('lehnt über 100 ab', () => {
    expect(reject(percentSchema, 100.01)).toBe('Höchstens 100 Prozent.')
  })
})

describe('quantitySchema und countSchema', () => {
  it('nimmt Nachkommastellen bei Mengen an', () => {
    expect(ok(quantitySchema, 2.5)).toBe(2.5)
  })

  it('lehnt Nachkommastellen bei Stückzahlen ab', () => {
    expect(reject(countSchema, 2.5)).toBe('Bitte eine ganze Zahl eingeben.')
  })
})

describe('dateSchema', () => {
  it('nimmt ein gültiges Datum an', () => {
    expect(ok(dateSchema, '2026-02-28')).toBe('2026-02-28')
  })

  it('nimmt den 29. Februar im Schaltjahr an', () => {
    expect(ok(dateSchema, '2028-02-29')).toBe('2028-02-29')
  })

  it('lehnt den 29. Februar im Nicht-Schaltjahr ab', () => {
    expect(reject(dateSchema, '2026-02-29')).toBe('Dieses Datum gibt es nicht.')
  })

  it('lehnt den 31. eines 30-tägigen Monats ab', () => {
    expect(reject(dateSchema, '2026-04-31')).toBe('Dieses Datum gibt es nicht.')
  })

  it('lehnt das deutsche Format ab', () => {
    expect(reject(dateSchema, '28.02.2026')).toBe(
      'Bitte ein Datum im Format JJJJ-MM-TT eingeben.',
    )
  })

  it('prüft Kalendertage direkt', () => {
    expect(isRealDate('2026-12-31')).toBe(true)
    expect(isRealDate('2026-13-01')).toBe(false)
    expect(isRealDate('kaputt')).toBe(false)
  })
})

describe('timeSchema', () => {
  it.each(['00:00', '08:30', '23:59'])('nimmt %s an', (value) => {
    expect(ok(timeSchema, value)).toBe(value)
  })

  it.each(['24:00', '8:30', '08:60'])('lehnt %s ab', (value) => {
    expect(reject(timeSchema, value)).toBe('Bitte eine Uhrzeit im Format HH:MM eingeben.')
  })
})

describe('Fahrzeugfelder', () => {
  it('macht Kennzeichen groß', () => {
    expect(ok(licensePlateSchema, ' b-mw 1234 ')).toBe('B-MW 1234')
  })

  it('lehnt ein einbuchstabiges Kennzeichen ab', () => {
    expect(reject(licensePlateSchema, 'B')).toBe('Bitte ein Kennzeichen eingeben.')
  })

  it('nimmt eine 17-stellige Fahrgestellnummer an', () => {
    expect(ok(vinSchema, 'wvwzzz1jz3w386752')).toBe('WVWZZZ1JZ3W386752')
  })

  it('lehnt die verbotenen Buchstaben I, O und Q ab', () => {
    expect(reject(vinSchema, 'WVWZZZ1JZ3W38675O')).toBe(
      'Die Fahrgestellnummer enthält ungültige Zeichen.',
    )
  })

  it('nimmt eine vierstellige HSN an', () => {
    expect(ok(hsnSchema, '0603')).toBe('0603')
  })

  it('lehnt eine dreistellige HSN ab', () => {
    expect(reject(hsnSchema, '603')).toBe('Die HSN besteht aus vier Ziffern.')
  })

  it('macht die TSN groß', () => {
    expect(ok(tsnSchema, 'bft')).toBe('BFT')
  })
})

describe('Freitext', () => {
  it('begrenzt Notizen auf 5000 Zeichen', () => {
    expect(ok(notesSchema, 'a'.repeat(5000))).toHaveLength(5000)
    expect(reject(notesSchema, 'a'.repeat(5001))).toBe('Höchstens 5000 Zeichen.')
  })

  it('begrenzt den Suchbegriff auf 200 Zeichen', () => {
    expect(reject(searchSchema, 'a'.repeat(201))).toBe(
      'Der Suchbegriff darf höchstens 200 Zeichen lang sein.',
    )
  })

  it('nimmt Umlaute und Sonderzeichen an', () => {
    expect(ok(citySchema, 'Müller-Lüdenscheidt Straße')).toBe('Müller-Lüdenscheidt Straße')
  })
})

describe('optionalText', () => {
  it('macht aus einer leeren Eingabe undefined statt eines leeren Textes', () => {
    expect(v.parse(optionalText(50), '   ')).toBeUndefined()
  })

  it('behält einen gefüllten Wert', () => {
    expect(v.parse(optionalText(50), ' Werkstatt ')).toBe('Werkstatt')
  })

  it('lässt ein fehlendes Feld fehlen', () => {
    expect(v.parse(optionalText(50), undefined)).toBeUndefined()
  })

  it('begrenzt auch den optionalen Wert', () => {
    expect(reject(optionalText(5), 'zu langer Text')).toBe('Höchstens 5 Zeichen.')
  })
})

describe('text mit eigener Meldung', () => {
  it('nutzt den übergebenen Text', () => {
    expect(reject(text(3, 'Das Kürzel ist zu lang.'), 'abcd')).toBe('Das Kürzel ist zu lang.')
  })
})
