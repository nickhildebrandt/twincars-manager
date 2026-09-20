/**
 * German is the default language for every validation message.
 *
 * The predecessor required a hand-written German message on every single pipe
 * step and then used two different heuristics to guess whether a message had
 * slipped through in English — one on the server (does it contain an umlaut?),
 * one in the browser (does it start with "Invalid"?). Both threw away correct
 * German messages (B-042, B-044).
 *
 * Here the language is simply set once. Built-in messages are German by
 * construction; a message is only written out when the standard wording does
 * not help the user.
 *
 * Import this module before parsing anything. `shared/schemas/index.ts` does
 * that for every consumer.
 */
import * as v from 'valibot'
import '@valibot/i18n/de'

v.setGlobalConfig({ lang: 'de' })

/**
 * Wording used across schemas, so the same situation reads the same way
 * everywhere.
 */
export const MESSAGES = {
  required: 'Pflichtfeld.',
  tooLong: (max: number) => `Höchstens ${max} Zeichen.`,
  tooShort: (min: number) => `Mindestens ${min} Zeichen.`,
  notANumber: 'Bitte eine Zahl eingeben.',
  negative: 'Darf nicht negativ sein.',
  invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben.',
  invalidDate: 'Bitte ein Datum im Format JJJJ-MM-TT eingeben.',
  invalidTime: 'Bitte eine Uhrzeit im Format HH:MM eingeben.',
  invalidId: 'Ungültige Kennung.',
} as const
