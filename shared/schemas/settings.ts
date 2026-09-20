/**
 * Firmeneinstellungen, Nummernkreise, Öffnungszeiten, SMTP (T-010).
 *
 * Ein Schema je Schritt des Assistenten — und **dieselben** Schemata gelten
 * später unter `/settings`. Der Assistent ist kein zweiter Weg in dieselben
 * Felder, sondern derselbe Weg in anderer Reihenfolge; zwei Schemata für ein
 * Feld wären zwei Wahrheiten.
 *
 * Alle Grenzen stammen aus `shared/schemas/primitives.ts` und passen zu den
 * Spalten; ein Drift-Test hält beides in Schritt.
 */
import * as v from 'valibot'
import { unknownEntries } from '../ip-range'
import { numberKinds, salutationStyles, smtpSecurities } from '../domain'
import {
  bicSchema,
  citySchema,
  emailSchema,
  ibanSchema,
  longTextSchema,
  moneySchema,
  notesSchema,
  phoneSchema,
  requiredText,
  safeIpRangesSchema,
  text,
  timeSchema,
  websiteSchema,
  zipSchema,
} from './primitives'
import { MESSAGES } from './messages'

/* ── Schritt 2: Firmendaten ───────────────────────────────────────────── */

/**
 * Die deutschen Bundesländer.
 *
 * Als Liste und nicht als Freitext: das Land steht auf dem Briefkopf und
 * geht in die öffentliche Schnittstelle. Ein Tippfehler dort fällt niemandem
 * auf und ist überall.
 */
export const GERMAN_STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
] as const

export const companyProfileSchema = v.object({
  companyName: requiredText(200, 'Bitte den Firmennamen eingeben.'),
  owner: v.optional(text(200)),
  street: requiredText(200, 'Bitte die Straße mit Hausnummer eingeben.'),
  zip: zipSchema,
  city: citySchema,
  state: v.picklist(GERMAN_STATES, 'Bitte ein Bundesland wählen.'),
  phone: phoneSchema,
  mobile: v.optional(phoneSchema),
  fax: v.optional(phoneSchema),
  email: emailSchema,
  website: v.optional(websiteSchema),
})

/* ── Schritt 3: Steuer und Bank ───────────────────────────────────────── */

/**
 * Der Steuersatz in Prozent.
 *
 * Als Zahl mit zwei Nachkommastellen, weil 7 % und 19 % nicht die einzigen
 * sind, die je galten: im Altbestand stehen 207 Rechnungen mit **16 %**
 * (M-44). Ein fester Satz im Code hätte die nie abbilden können.
 */
export const vatRateSchema = v.pipe(
  v.union(
    [
      v.number(),
      v.pipe(v.string(), v.trim(), v.transform(value => Number(value.replace(',', '.')))),
    ],
    'Bitte einen Steuersatz eingeben.',
  ),
  v.number('Bitte einen Steuersatz eingeben.'),
  v.minValue(0, 'Der Steuersatz darf nicht negativ sein.'),
  v.maxValue(100, 'Der Steuersatz darf höchstens 100 % betragen.'),
)

export const companyTaxSchema = v.object({
  taxNumber: requiredText(30, 'Bitte die Steuernummer eingeben.'),
  /** USt-IdNr. — ohne Formatprüfung: die Formate der EU sind zu verschieden. */
  vatId: v.optional(text(30)),
  /**
   * §19 UStG — Kleinunternehmer.
   *
   * Steuert den Summenblock und den Hinweistext auf jedem Beleg sowie die
   * Kategorie in der XRechnung. **Nicht** die Berechnung: wer die Regelung
   * nutzt, weist gar keine Steuer aus.
   */
  smallBusinessExempt: v.optional(v.boolean(), false),
  defaultVatRate: v.optional(vatRateSchema, 19),
  bankName: v.optional(text(100)),
  iban: v.optional(ibanSchema),
  bic: v.optional(bicSchema),
})

/* ── Schritt 4: Belege ────────────────────────────────────────────────── */

/**
 * Eine Nummernvorlage.
 *
 * Die Platzhalter, die gerendert werden: `{YYYY}` vierstelliges Jahr, `{YY}`
 * zweistellig, `{MM}` Monat, `{N}` … `{NNNNN}` der Zähler mit so vielen
 * Stellen, wie Buchstaben dastehen.
 *
 * **Der Zähler ist Pflicht.** Eine Vorlage ohne `{N}` gäbe jedem Beleg
 * dieselbe Nummer — und der eindeutige Index ließe den zweiten nicht zu. Das
 * wäre ein Fehler beim Ausstellen statt beim Einrichten.
 */
export const numberTemplateSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Bitte eine Vorlage eingeben.'),
  v.maxLength(50, MESSAGES.tooLong(50)),
  v.check(
    value => /\{N+\}/.test(value),
    'Die Vorlage braucht einen Zähler, zum Beispiel {NNNN}.',
  ),
  v.check(
    value => !/\{(?!YYYY\}|YY\}|MM\}|N+\})/.test(value),
    'Die Vorlage enthält einen unbekannten Platzhalter. Erlaubt sind {YYYY}, {YY}, {MM} und {N…}.',
  ),
)

export const numberRangeSchema = v.object({
  kind: v.picklist(numberKinds.values, 'Unbekannte Nummernart.'),
  formatTemplate: numberTemplateSchema,
  /**
   * Der nächste Wert.
   *
   * Beim Einrichten frei wählbar, damit der Betrieb oberhalb seiner
   * Altnummern anfangen kann (M-44). Danach zählt ihn nur noch die Vergabe
   * hoch.
   */
  nextValue: v.pipe(
    v.union(
      [v.number(), v.pipe(v.string(), v.trim(), v.regex(/^\d+$/, 'Bitte eine ganze Zahl eingeben.'), v.transform(Number))],
      'Bitte eine ganze Zahl eingeben.',
    ),
    v.integer('Bitte eine ganze Zahl eingeben.'),
    v.minValue(1, 'Der Startwert beginnt bei 1.'),
    v.maxValue(99_999_999, 'Der Startwert ist zu groß.'),
  ),
})

export const documentDefaultsSchema = v.object({
  salutationStyle: v.optional(
    v.picklist(salutationStyles.values, 'Bitte „Sie" oder „Du" wählen.'),
    'Sie',
  ),
  /** Zahlungsziel in Tagen. Null heißt „sofort fällig". */
  defaultPaymentTermDays: v.optional(
    v.pipe(
      v.union(
        [v.number(), v.pipe(v.string(), v.trim(), v.regex(/^\d+$/, 'Bitte eine ganze Zahl eingeben.'), v.transform(Number))],
        'Bitte eine ganze Zahl eingeben.',
      ),
      v.integer('Bitte eine ganze Zahl eingeben.'),
      v.minValue(0, 'Das Zahlungsziel darf nicht negativ sein.'),
      v.maxValue(365, 'Ein Zahlungsziel über einem Jahr ist vermutlich ein Vertipper.'),
    ),
    14,
  ),
  /** Der Stundensatz in Cent (E-10). Landet als Preisversion am Artikel (M-22). */
  laborRate: v.optional(moneySchema),
  pdfFooter: v.optional(longTextSchema),
  numberRanges: v.optional(v.array(numberRangeSchema), []),
})

/* ── Schritt 5: Öffnungszeiten ────────────────────────────────────────── */

/**
 * **Sonntag ist 0, Samstag ist 6.**
 *
 * Nicht ISO 8601, wo Montag die 1 wäre — sondern genau das, was
 * `businessWeekday()` in `shared/datetime.ts` liefert und was der Seed
 * geschrieben hat. Eine zweite Zählweise daneben hieße, an jeder Stelle
 * umzurechnen, an der geprüft wird, ob gerade offen ist. Genau dort entstehen
 * Fehler, die sich als „montags geschlossen" zeigen.
 *
 * Die **Anzeige** beginnt trotzdem bei Montag; das ist eine Frage der
 * Reihenfolge in der Tabelle, nicht der Speicherung.
 */
export const workshopHoursSchema = v.pipe(
  v.object({
    weekday: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0, 'Wochentag außerhalb des Bereichs.'),
      v.maxValue(6, 'Wochentag außerhalb des Bereichs.'),
    ),
    closed: v.optional(v.boolean(), false),
    opensAt: timeSchema,
    closesAt: timeSchema,
  }),
  // Geprüft wird nur an einem offenen Tag: an einem geschlossenen stehen die
  // Zeiten aus der Vorgabe, und die sollen niemanden aufhalten.
  v.forward(
    v.check(
      day => day.closed || day.closesAt > day.opensAt,
      'Das Schließen muss nach dem Öffnen liegen.',
    ),
    ['closesAt'],
  ),
)

export const workshopWeekSchema = v.pipe(
  v.array(workshopHoursSchema),
  v.length(7, 'Es müssen alle sieben Wochentage angegeben sein.'),
  v.check(
    days => new Set(days.map(day => day.weekday)).size === 7,
    'Jeder Wochentag darf nur einmal vorkommen.',
  ),
)

/* ── Schritt 6: E-Mail ────────────────────────────────────────────────── */

export const smtpSchema = v.object({
  host: requiredText(255, 'Bitte den Mailserver eingeben.'),
  port: v.pipe(
    v.union(
      [v.number(), v.pipe(v.string(), v.trim(), v.regex(/^\d+$/, 'Bitte eine Portnummer eingeben.'), v.transform(Number))],
      'Bitte eine Portnummer eingeben.',
    ),
    v.integer('Bitte eine Portnummer eingeben.'),
    v.minValue(1, 'Die Portnummer liegt zwischen 1 und 65535.'),
    v.maxValue(65_535, 'Die Portnummer liegt zwischen 1 und 65535.'),
  ),
  secure: v.picklist(smtpSecurities.values, 'Unbekannte Verschlüsselung.'),
  username: v.optional(text(200)),
  /** Leer heißt „nicht ändern" — das gespeicherte Passwort bleibt stehen. */
  password: v.optional(text(500)),
  fromAddress: emailSchema,
  fromName: requiredText(200, 'Bitte einen Absendernamen eingeben.'),
  replyTo: v.optional(emailSchema),
})

/* ── Schritt 7: Zugang ────────────────────────────────────────────────── */

export const securitySettingsSchema = v.object({
  /**
   * Wohin gravierende Vorfälle gemeldet werden (P-23).
   *
   * Getrennt von der Geschäftsadresse: die steht auf jeder Rechnung, diese
   * hier liest jemand, der etwas tun kann.
   */
  adminEmail: v.optional(emailSchema),
  safeIpRanges: v.optional(safeIpRangesSchema, ''),
})

/* ── Was der Assistent am Ende zusammenträgt ──────────────────────────── */

export const completeSetupSchema = v.object({
  profile: companyProfileSchema,
  tax: companyTaxSchema,
  documents: documentDefaultsSchema,
  hours: workshopWeekSchema,
  security: securitySettingsSchema,
})

export type CompanyProfile = v.InferOutput<typeof companyProfileSchema>
export type CompanyTax = v.InferOutput<typeof companyTaxSchema>
export type DocumentDefaults = v.InferOutput<typeof documentDefaultsSchema>
export type WorkshopDay = v.InferOutput<typeof workshopHoursSchema>
export type SmtpInput = v.InferOutput<typeof smtpSchema>
export type SecuritySettings = v.InferOutput<typeof securitySettingsSchema>
export type NumberRangeInput = v.InferOutput<typeof numberRangeSchema>

/** Unbenutzte Einfuhr vermeiden: die Prüfung der Bereiche steckt im Primitive. */
export const describeUnknownRanges = unknownEntries

/** Notizfeld, das mehrere Schritte teilen. */
export const setupNotesSchema = notesSchema
