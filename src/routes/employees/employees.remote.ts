import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  object,
  optional,
  picklist,
  pipe,
  number,
  string,
  trim,
  maxLength
} from 'valibot'
import {
  idSchema,
  notesSchema,
  optionalEmailSchema
} from '$lib/server/db/validation'
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  nextPersonnelNumber,
  updateEmployee
} from '$lib/server/services/employee-service'

const employeeInputSchema = object({
  personnelNumber: optional(pipe(string(), trim(), maxLength(30))),
  salutation: optional(pipe(string(), trim(), maxLength(30))),
  title: optional(pipe(string(), trim(), maxLength(30))),
  firstName: pipe(string(), trim(), maxLength(100)),
  lastName: pipe(string(), trim(), maxLength(100)),
  birthday: optional(pipe(string(), trim(), maxLength(10))),
  birthplace: optional(pipe(string(), trim(), maxLength(100))),
  nationality: optional(pipe(string(), trim(), maxLength(50))),
  street: optional(pipe(string(), trim(), maxLength(200))),
  zip: optional(pipe(string(), trim(), maxLength(10))),
  city: optional(pipe(string(), trim(), maxLength(150))),
  country: optional(pipe(string(), trim(), maxLength(100))),
  privateEmail: optionalEmailSchema,
  privatePhone: optional(pipe(string(), trim(), maxLength(30))),
  mobile: optional(pipe(string(), trim(), maxLength(30))),
  hireDate: optional(pipe(string(), trim(), maxLength(10))),
  terminationDate: optional(pipe(string(), trim(), maxLength(10))),
  position: optional(pipe(string(), trim(), maxLength(150))),
  department: optional(pipe(string(), trim(), maxLength(100))),
  employmentType: optional(pipe(string(), trim(), maxLength(30))),
  weeklyHours: optional(number()),
  monthlySalary: optional(number()),
  hourlyWage: optional(number()),
  vacationDaysPerYear: optional(number()),
  taxId: optional(pipe(string(), trim(), maxLength(30))),
  taxClass: optional(pipe(string(), trim(), maxLength(5))),
  socialInsuranceNumber: optional(pipe(string(), trim(), maxLength(30))),
  healthInsurance: optional(pipe(string(), trim(), maxLength(100))),
  bankAccountHolder: optional(pipe(string(), trim(), maxLength(200))),
  bankIban: optional(pipe(string(), trim(), maxLength(34))),
  bankBic: optional(pipe(string(), trim(), maxLength(11))),
  bankName: optional(pipe(string(), trim(), maxLength(100)))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  archived: optional(picklist(['active', 'archived', 'all']))
})

/**
 * Paginated employee list.
 *
 * @group integration
 * @module employees
 */
export const listEmployeesRemote = query(listSchema, async (params) => {
  const archivedFilter =
    params.archived === 'archived'
      ? true
      : params.archived === 'active'
        ? false
        : undefined
  return listEmployees({ ...params, archived: archivedFilter })
})

/**
 * Load a single employee.
 *
 * @group integration
 * @module employees
 */
export const getEmployeeRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const e = await getEmployee(id)
    if (!e) error(404, 'Mitarbeiter nicht gefunden.')
    return e
  }
)

/**
 * Create employee.
 *
 * @group integration
 * @module employees
 */
export const createEmployeeRemote = command(
  employeeInputSchema,
  async (values) => {
    const personnelNumber =
      values.personnelNumber || (await nextPersonnelNumber())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await createEmployee({ ...(values as any), personnelNumber })
    void listEmployeesRemote({ page: 1, size: 25 }).refresh()
    return data
  }
)

/**
 * Update employee.
 *
 * @group integration
 * @module employees
 */
export const updateEmployeeRemote = command(
  object({ id: idSchema, values: employeeInputSchema }),
  async ({ id, values }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await updateEmployee(id, values as any)
    void listEmployeesRemote({ page: 1, size: 25 }).refresh()
    void getEmployeeRemote({ id }).refresh()
    return data
  }
)

/**
 * Delete employee.
 *
 * @group integration
 * @module employees
 */
export const deleteEmployeeRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteEmployee(id)
    void listEmployeesRemote({ page: 1, size: 25 }).refresh()
  }
)
