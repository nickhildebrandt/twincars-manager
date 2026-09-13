/**
 * Valibot schemas for the discriminators.
 *
 * Each one is built from the very list in `shared/domain.ts` that the database
 * `CHECK` constraint and the German label come from. A value the schema
 * accepts is therefore always a value the database accepts and the interface
 * can name — the three could not disagree if they tried.
 */
import * as v from 'valibot'
import type { Domain } from '../domain'
import {
  absenceStatuses,
  auditActions,
  absenceTypes,
  appointmentStatuses,
  calendarKinds,
  customerKinds,
  documentStatuses,
  documentTypes,
  ebayEnvironments,
  ebayListingStatuses,
  importRunStatuses,
  inquiryReferenceTypes,
  inquiryStatuses,
  itemKinds,
  itemLineKinds,
  ledgerDirections,
  ledgerPaymentStatuses,
  ledgerSources,
  listingStatuses,
  messageKinds,
  messageStatuses,
  messageSubjects,
  numberKinds,
  paymentMethods,
  reminderSeasons,
  reminderStatuses,
  salutationStyles,
  smtpSecurities,
  tireConstructions,
  tireSeasons,
  vehicleStatuses,
  wheelSetStates,
  workOrderItemKinds,
  workOrderStatuses,
} from '../domain'

/**
 * A picklist over a domain, with a German message naming what was expected.
 *
 * The message lists the labels, not the codes: "Bitte Rechnung, Angebot …
 * wählen" helps, "invalid enum value" does not.
 */
function pick<T extends string>(from: Domain<T>, what: string) {
  const choices = from.values.map(value => from.labels[value]).join(', ')
  return v.picklist(from.values, `${what}: bitte einen der Werte ${choices} wählen.`)
}

export const documentTypeSchema = pick(documentTypes, 'Belegart')
export const documentStatusSchema = pick(documentStatuses, 'Belegstatus')
export const paymentMethodSchema = pick(paymentMethods, 'Zahlungsart')
export const itemLineKindSchema = pick(itemLineKinds, 'Positionsart')
export const itemKindSchema = pick(itemKinds, 'Artikelart')
export const workOrderStatusSchema = pick(workOrderStatuses, 'Auftragsstatus')
export const workOrderItemKindSchema = pick(workOrderItemKinds, 'Positionsart')
export const calendarKindSchema = pick(calendarKinds, 'Eintragsart')
export const appointmentStatusSchema = pick(appointmentStatuses, 'Terminstatus')
export const absenceTypeSchema = pick(absenceTypes, 'Abwesenheitsart')
export const absenceStatusSchema = pick(absenceStatuses, 'Abwesenheitsstatus')
export const customerKindSchema = pick(customerKinds, 'Kundenart')
export const messageStatusSchema = pick(messageStatuses, 'Versandstatus')
export const messageKindSchema = pick(messageKinds, 'Nachrichtenart')
export const inquiryReferenceTypeSchema = pick(inquiryReferenceTypes, 'Bezug')
export const inquiryStatusSchema = pick(inquiryStatuses, 'Bearbeitungsstand')
export const messageSubjectSchema = pick(messageSubjects, 'Bezug der Nachricht')
export const vehicleStatusSchema = pick(vehicleStatuses, 'Fahrzeugstatus')
export const wheelSetStateSchema = pick(wheelSetStates, 'Zustand des Radsatzes')
export const auditActionSchema = pick(auditActions, 'Art der Änderung')
export const reminderStatusSchema = pick(reminderStatuses, 'Erinnerungsstatus')
export const listingStatusSchema = pick(listingStatuses, 'Inseratstatus')
export const tireSeasonSchema = pick(tireSeasons, 'Saison')
export const tireConstructionSchema = pick(tireConstructions, 'Bauart')
export const reminderSeasonSchema = pick(reminderSeasons, 'Saison')
export const ledgerDirectionSchema = pick(ledgerDirections, 'Richtung')
export const ledgerPaymentStatusSchema = pick(ledgerPaymentStatuses, 'Zahlungsstatus')
export const ledgerSourceSchema = pick(ledgerSources, 'Herkunft')
export const numberKindSchema = pick(numberKinds, 'Nummernkreis')
export const ebayListingStatusSchema = pick(ebayListingStatuses, 'Angebotsstatus')
export const importRunStatusSchema = pick(importRunStatuses, 'Laufstatus')
export const ebayEnvironmentSchema = pick(ebayEnvironments, 'Umgebung')
export const smtpSecuritySchema = pick(smtpSecurities, 'Verschlüsselung')
export const salutationStyleSchema = pick(salutationStyles, 'Anrede')
