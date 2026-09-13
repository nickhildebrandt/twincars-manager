/**
 * German labels for schema field names.
 *
 * A validation error names the field by its technical key (`bankIban`,
 * `items.0.quantity`). The user must read "IBAN" and "Menge (Position 1)"
 * instead. This map is the single place where that translation happens.
 *
 * **Every new schema field needs an entry here.** A cross-cutting test walks
 * all schemas and fails when a key has no label
 * (../../../docs/rewrite/05-teststrategie.md §4.6).
 */

export const FIELD_LABELS: Record<string, string> = {
  // identity and generic
  id: 'Kennung',
  page: 'Seite',
  q: 'Suchbegriff',
  sort: 'Sortierung',
  dir: 'Sortierrichtung',
  notes: 'Notiz',
  description: 'Beschreibung',
  name: 'Name',
  title: 'Titel',
  status: 'Status',
  kind: 'Art',
  customerKind: 'Kundenart',
  type: 'Typ',
  active: 'Aktiv',
  archived: 'Archiviert',

  // people
  salutation: 'Anrede',
  firstName: 'Vorname',
  lastName: 'Nachname',
  company: 'Firma',
  customerNumber: 'Kundennummer',
  personnelNumber: 'Personalnummer',
  birthday: 'Geburtstag',

  // address and contact
  street: 'Straße',
  zip: 'Postleitzahl',
  city: 'Ort',
  country: 'Land',
  phone: 'Telefon',
  mobile: 'Mobil',
  fax: 'Fax',
  email: 'E-Mail',
  website: 'Internetadresse',

  // banking and tax
  bankIban: 'IBAN',
  bankBic: 'BIC',
  bankName: 'Bank',
  iban: 'IBAN',
  bic: 'BIC',
  taxNumber: 'Steuernummer',
  vatId: 'Umsatzsteuer-Identifikationsnummer',
  smallBusinessExempt: 'Kleinunternehmerregelung',
  equipment: 'Ausstattung',
  internalNotes: 'Interne Notiz',
  highlights: 'Besonderheiten',

  // money
  unitPriceNet: 'Einzelpreis netto',
  purchasePriceNet: 'Einkaufspreis netto',
  priceNet: 'Preis netto',
  totalNet: 'Summe netto',
  totalGross: 'Summe brutto',
  taxRate: 'Steuersatz',
  discountPercent: 'Rabatt',
  amount: 'Betrag',
  quantity: 'Menge',
  unit: 'Einheit',
  currency: 'Währung',
  paymentMethod: 'Zahlungsart',
  paymentTermDays: 'Zahlungsziel',
  hourlyRate: 'Stundensatz',

  // documents
  documentNumber: 'Belegnummer',
  invoiceNumber: 'Rechnungsnummer',
  issueDate: 'Belegdatum',
  dueDate: 'Fälligkeitsdatum',
  paidAt: 'Bezahlt am',
  headerText: 'Kopftext',
  footerText: 'Endtext',
  positions: 'Positionen',
  items: 'Positionen',

  // vehicles
  licensePlate: 'Kennzeichen',
  vin: 'Fahrgestellnummer',
  hsn: 'HSN',
  tsn: 'TSN',
  make: 'Marke',
  model: 'Modell',
  firstRegistration: 'Erstzulassung',
  mileageKm: 'Kilometerstand',
  inspectionDue: 'HU fällig',
  colour: 'Farbe',
  fuel: 'Kraftstoff',
  transmission: 'Getriebe',
  powerKw: 'Leistung',
  customerId: 'Kunde',
  vehicleId: 'Fahrzeug',
  previousOwnerCustomerId: 'Vorbesitzer',

  // tires
  width: 'Breite',
  aspectRatio: 'Querschnitt',
  construction: 'Bauart',
  diameterInch: 'Felgendurchmesser',
  loadIndex: 'Lastindex',
  speedIndex: 'Geschwindigkeitsindex',
  season: 'Saison',
  ean: 'EAN',
  profileMm: 'Profiltiefe',
  dotYear: 'DOT-Jahr',
  storageNumber: 'Lagernummer',
  storedAt: 'Eingelagert am',
  retrievedAt: 'Abgeholt am',
  onlineSellable: 'Online verkaufbar',
  onlineBookable: 'Online buchbar',

  // orders and time
  employeeId: 'Mitarbeiter',
  assigneeIds: 'Zugewiesene Mitarbeiter',
  workOrderId: 'Auftrag',
  scheduledDate: 'Geplantes Datum',
  scheduledTime: 'Geplante Uhrzeit',
  plannedHours: 'Geplante Stunden',
  hours: 'Stunden',
  startedAt: 'Beginn',
  endedAt: 'Ende',
  breakMinutes: 'Pause',
  workDate: 'Arbeitstag',

  // employees
  hiredAt: 'Eintrittsdatum',
  leftAt: 'Austrittsdatum',
  weeklyHours: 'Wochenstunden',
  vacationDays: 'Urlaubstage',
  monthlySalary: 'Monatsgehalt',
  hourlyWage: 'Stundenlohn',
  validFrom: 'Gültig ab',
  absenceType: 'Abwesenheitsart',
  halfDay: 'Halber Tag',

  // calendar
  startsAt: 'Beginn',
  endsAt: 'Ende',
  allDay: 'Ganztägig',
  date: 'Datum',
  fromDate: 'Von',
  toDate: 'Bis',

  // mail
  subject: 'Betreff',
  body: 'Nachricht',
  to: 'Empfänger',
  fromAddress: 'Absenderadresse',
  fromName: 'Absendername',
  replyTo: 'Antwortadresse',
  host: 'Server',
  port: 'Port',
  secure: 'Verschlüsselung',
  username: 'Benutzername',
  password: 'Passwort',
  attachments: 'Anhänge',
  asHtml: 'Als HTML senden',
  wantsBroadcast: 'Rundschreiben erwünscht',
  wantsTireReminders: 'Reifenerinnerungen erwünscht',

  // accounting
  categoryId: 'Kategorie',
  bookingDate: 'Buchungsdatum',
  receiptNumber: 'Belegnummer',
  netAmount: 'Netto',
  grossAmount: 'Brutto',
  taxAmount: 'Steuer',
  direction: 'Art der Buchung',

  // users and roles
  roleId: 'Rolle',
  roleIds: 'Rollen',
  permissions: 'Berechtigungen',
  newPassword: 'Neues Passwort',
  currentPassword: 'Aktuelles Passwort',
  confirmPassword: 'Passwort bestätigen',

  // settings and files
  file: 'Datei',
  logo: 'Logo',
  slug: 'Adresse',
  publishedAt: 'Veröffentlicht am',
  weekday: 'Wochentag',
  opensAt: 'Öffnet um',
  closesAt: 'Schließt um',
  closed: 'Geschlossen',
  federalState: 'Bundesland',
}

/**
 * Turns a Valibot issue path into a German label.
 *
 *   `bankIban`            → "IBAN"
 *   `items.0.quantity`    → "Menge (Position 1)"
 *   `values.firstName`    → "Vorname"   (the wrapper is skipped)
 *
 * An unknown key falls back to the raw key: it is better to name a field the
 * user can find than to hide which input was wrong.
 */
export function labelForPath(path: string): string {
  const parts = path.split('.').filter(part => part !== 'values' && part !== 'body')
  const indexes: number[] = []
  const names: string[] = []

  for (const part of parts) {
    if (/^\d+$/.test(part)) indexes.push(Number(part) + 1)
    else names.push(part)
  }

  const key = names.at(-1) ?? path
  const label = FIELD_LABELS[key] ?? key
  return indexes.length > 0 ? `${label} (Position ${indexes.join('.')})` : label
}

/** Every key this map knows — used by the completeness test. */
export const KNOWN_FIELD_KEYS = new Set(Object.keys(FIELD_LABELS))
