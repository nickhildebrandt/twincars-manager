import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  boolean,
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema, notesSchema } from '$lib/server/db/validation'
import {
  createSpecialPayment,
  deleteSpecialPayment,
  getSpecialPayment,
  listSpecialPayments,
  updateSpecialPayment
} from '$lib/server/services/special-payment-service'

const inputSchema = object({
  label: pipe(string(), trim(), maxLength(200)),
  kind: picklist(['one_time', 'recurring']),
  amount: number(),
  startMonth: pipe(string(), trim(), maxLength(10)),
  endMonth: optional(pipe(string(), trim(), maxLength(10))),
  targetAll: boolean(),
  employeeIds: optional(array(idSchema)),
  notes: optional(notesSchema)
})

/**
 * Paginierte Liste aller Sonderzahlungen mit ihren zugewiesenen
 * Mitarbeitern. Filter `kind` nach Art (alle / einmalig / wiederkehrend).
 *
 * @group integration
 * @module specialPayments
 */
export const listSpecialPaymentsRemote = query(
  object({
    page: number(),
    size: picklist([10, 25, 50, 100]),
    kind: optional(picklist(['all', 'one_time', 'recurring'])),
    q: optional(pipe(string(), trim(), maxLength(200)))
  }),
  async ({ page, size, kind, q }) =>
    listSpecialPayments(page, size, kind ?? 'all', q || undefined)
)

/**
 * Einzelne Sonderzahlung — für die Edit-Seite.
 *
 * @group integration
 * @module specialPayments
 */
export const getSpecialPaymentRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await getSpecialPayment(id)
    if (!row) error(404, 'Sonderzahlung nicht gefunden.')
    return row
  }
)

/**
 * Sonderzahlung anlegen.
 *
 * @group integration
 * @module specialPayments
 */
export const createSpecialPaymentRemote = command(
  inputSchema,
  async (input) => {
    const row = await createSpecialPayment(input)
    await requested(listSpecialPaymentsRemote, 4).refreshAll()
    return row
  }
)

/**
 * Sonderzahlung aktualisieren — ersetzt auch die Mitarbeiter-Zuordnung
 * komplett.
 *
 * @group integration
 * @module specialPayments
 */
export const updateSpecialPaymentRemote = command(
  object({ id: idSchema, values: inputSchema }),
  async ({ id, values }) => {
    const row = await updateSpecialPayment(id, values)
    await Promise.all([
      getSpecialPaymentRemote({ id }).refresh(),
      requested(listSpecialPaymentsRemote, 4).refreshAll()
    ])
    return row
  }
)

/**
 * Sonderzahlung löschen.
 *
 * @group integration
 * @module specialPayments
 */
export const deleteSpecialPaymentRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteSpecialPayment(id)
    await requested(listSpecialPaymentsRemote, 4).refreshAll()
  }
)
