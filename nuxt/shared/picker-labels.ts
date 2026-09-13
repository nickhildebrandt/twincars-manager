/**
 * Wie ein Datensatz in einer Auswahl heißt — an genau einer Stelle.
 *
 * Der Vorgänger versprach in der Kopfzeile dieser Datei „single source of
 * truth" und baute die Beschriftungen für Mitarbeiter, Lieferanten, Belege,
 * Artikel und Reifen trotzdem an sechs Stellen im Servercode zusammen
 * (B-087). Das Ergebnis: die Auswahlliste zeigte einen Namen, die
 * Selbstauswahl nach dem Anlegen suchte nach einem anderen.
 *
 * Beschriftung und Unterzeile werden **auf dem Server** gebaut und wandern
 * fertig zum Client. Der Client setzt nichts zusammen — sonst entstünde
 * dieselbe Doppelung noch einmal.
 */

/** Was jede Auswahl liefert, gleich um welche Sache es geht. */
export type PickerOption = {
  id: string
  /** Die Zeile, die der Nutzer liest und nach der er sucht. */
  label: string
  /** Die kleinere Zeile darunter. Leer, wenn es nichts zu ergänzen gibt. */
  sublabel?: string
}

/** Fügt zusammen, was da ist, und lässt weg, was fehlt. */
const join = (parts: (string | null | undefined)[], separator = ' · '): string =>
  parts.map(part => part?.trim()).filter(Boolean).join(separator)

/**
 * Kunde: Firma, sonst Nachname und Vorname.
 *
 * Ein Firmenkunde wird über die Firma gesucht, eine Privatperson über den
 * Nachnamen — deshalb steht er vorn.
 */
export function customerLabel(customer: {
  company?: string | null
  lastName?: string | null
  firstName?: string | null
  customerNumber?: string | null
}): PickerOption['label'] {
  const person = join([customer.lastName, customer.firstName], ', ')
  return customer.company?.trim() || person || customer.customerNumber?.trim() || 'Ohne Namen'
}

export const customerSublabel = (customer: {
  customerNumber?: string | null
  zip?: string | null
  city?: string | null
}): string => join([customer.customerNumber, join([customer.zip, customer.city], ' ')])

/** Fahrzeug: Marke und Modell, darunter Kennzeichen und Fahrgestellnummer. */
export const vehicleLabel = (vehicle: {
  make?: string | null
  model?: string | null
}): string => join([vehicle.make, vehicle.model], ' ') || 'Ohne Bezeichnung'

export const vehicleSublabel = (vehicle: {
  licensePlate?: string | null
  vin?: string | null
  firstRegistration?: string | null
}): string => join([vehicle.licensePlate, vehicle.vin, vehicle.firstRegistration])

/** Artikel: Bezeichnung, darunter Artikelnummer und Einheit. */
export const itemLabel = (item: { description?: string | null }): string =>
  item.description?.trim() || 'Ohne Bezeichnung'

export const itemSublabel = (item: {
  articleNumber?: string | null
  unit?: string | null
}): string => join([item.articleNumber, item.unit])

/** Reifen: Marke und Modell, darunter Größe und Saison. */
export const tireLabel = (tire: {
  brand?: string | null
  model?: string | null
}): string => join([tire.brand, tire.model], ' ') || 'Ohne Bezeichnung'

export const tireSublabel = (tire: {
  size?: string | null
  seasonLabel?: string | null
  articleNumber?: string | null
}): string => join([tire.size, tire.seasonLabel, tire.articleNumber])

/** Mitarbeiter: Nachname und Vorname, darunter Personalnummer. */
export const employeeLabel = (employee: {
  lastName?: string | null
  firstName?: string | null
}): string => join([employee.lastName, employee.firstName], ', ') || 'Ohne Namen'

export const employeeSublabel = (employee: {
  personnelNumber?: string | null
  jobTitle?: string | null
}): string => join([employee.personnelNumber, employee.jobTitle])

/** Lieferant: Name, darunter Ort und eigene Kundennummer dort. */
export const supplierLabel = (supplier: { name?: string | null }): string =>
  supplier.name?.trim() || 'Ohne Namen'

export const supplierSublabel = (supplier: {
  city?: string | null
  customerNumberAtSupplier?: string | null
}): string => join([supplier.city, supplier.customerNumberAtSupplier])

/**
 * Beleg: Art und Nummer, darunter Datum und Betrag.
 *
 * Ein Entwurf trägt noch keine Nummer (M-14) — dann steht dort, dass es einer
 * ist, statt einer leeren Stelle.
 */
export const documentLabel = (document: {
  typeLabel?: string | null
  documentNumber?: string | null
}): string => join([document.typeLabel, document.documentNumber?.trim() || 'Entwurf'], ' ')

export const documentSublabel = (document: {
  issueDate?: string | null
  totalLabel?: string | null
  customerLabel?: string | null
}): string => join([document.issueDate, document.customerLabel, document.totalLabel])
