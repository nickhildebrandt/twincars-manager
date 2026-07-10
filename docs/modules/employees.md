---
title: Module - employees (Mitarbeiter)
tags: [module, employees, hr, absences]
updated: 2026-07-10
---

# employees - "Mitarbeiter"

- **Purpose**: HR master data, versioned salaries, absences
  (Urlaub/Krankheit/Sonstiges).
- **Routes**: `/employees`, `/employees/new`, `/employees/[id]` (detail
  incl. salary versions + absence management), `/employees/[id]/edit`.
- **Remote** `employees.remote.ts`: `listEmployeesRemote`,
  `getEmployeeRemote`, `createEmployeeRemote`, `updateEmployeeRemote`,
  `deleteEmployeeRemote`, `listEmployeeSalaryVersionsRemote`,
  `upsertEmployeeSalaryVersionRemote`,
  `deleteEmployeeSalaryVersionRemote`, `listAbsencesRemote`,
  `createAbsenceRemote`, `getAbsenceConflictsRemote`,
  `updateAbsenceRemote`, `deleteAbsenceRemote`. Guard
  `requirePermission('employees')` - proven by tests: `hours` /
  `hours:write_own` grants do NOT open the absence remotes.
- **Services**: `employee-service.ts` (incl.
  `getEffectiveSalary(employeeId, dateIso)`), `absence-service.ts`.
- **Tables**: `employees` (no salary columns since migration 0008;
  `vacationDaysPerYear` nullable = no limit), `employee_salary_versions`,
  `employee_absences` (types vacation/sick/other, `halfDay`, optional
  attachment as base64, e.g. AU-Bescheinigung).

## Absences (completed 2026-07 per the Teil-A spec)

- **Server-computed workday counts** - the client never does day math.
  `listAbsencesRemote({ employeeId, year? })` returns
  `{ absences, balance }` where every row is workday-enriched
  (`listAbsencesWithWorkdays`: weekends AND the company Bundesland's
  public holidays skipped, [[holidays]]; per-year splits for
  year-crossing rows) and `balance` is the year-scoped
  `remainingVacationDays` result (`{ year, entitled, used, remaining }`,
  following the year picker).
- **Hard vacation-budget gate** (`checkVacationBudget`, spec decision 4
  "harte Sperre"): checked per touched calendar year; a request over
  the remaining budget is a 400 with the remaining-days message.
  Employees without a configured `vacationDaysPerYear` are unlimited
  (`null` = not configured, deliberately distinct from an explicit 0).
- **Overlap semantics (canonical)**: same-type overlap is a hard 400
  (would double-count); vacation↔sick cross-conflicts on CREATE are a
  409 + replace-confirm flow (`getAbsenceConflictsRemote` before
  create, `replaceConflicting: true` deletes the conflicting rows);
  on UPDATE cross-conflicts are rejected with a curated 409 (no
  replace flow - the user adjusts the existing entry first); `other`
  never conflicts.
- **Half-day**: `halfDay` counts 0.5 workdays, single-day only
  (client + server enforced); sick entries for a following year are
  rejected.
- **Single-flight lesson** (was a live bug in shipped code): the
  client must declare `.updates(listAbsencesRemote(args), ...)` on the
  mutation - server-side `requested(...).refreshAll()` ALONE never
  refreshes the client ([[remote-functions]], CONTRIBUTING §5).
  Cross-year mutations declare both touched years' list instances.
- **UI**: `AbsenceSection.svelte` (extracted, testable) on the
  employee detail; year picker, conflict modal, attachment upload.
- **Still unimplemented** from the approved 2026-06-23 design
  (`archive/specs/2026-06-23-employee-absences-vacation-design.md`):
  Übertrag/carryover (decision 2 - `employees` has no
  `vacation_carryover*` columns), automatic Betriebsschließungs-
  Anrechnung incl. the warning + override modal and
  `previewClosureImpact` (decision 3 + the closure half of decision 4),
  and the `workshop_hours`-based workday model (decision 1 - the
  current model is weekends + public holidays, not opening days).

## Other specials

- Salaries follow the versioned-values convention
  ([[adr-007-price-snapshots-and-versions]]).
- Absences feed the [[calendar]] month grid
  (employee_vacation/sick/other event kinds).
- Payroll was removed (migration 0015) in favor of time tracking
  ([[hours]]).
- `/employees/new` doubles as a creation-flow leaf ([[creation-flow]]);
  work-order assignees pick employees through `MultiSearchablePicker`
  ([[orders]]).
- **Picker**: `pickEmployeesRemote` (also open to `orders` permission
  holders; search: name, personnel number, position, private
  email/phone, mobile).
- **Tests**: `employee-service.test.ts`, `absence-service.test.ts`,
  `employees.remote.test.ts` (incl. permission proofs),
  `AbsenceSection.test.ts`, `EmployeeForm.test.ts`,
  `e2e/employees.spec.ts` (holiday-aware counts, half-day rule,
  overlap semantics, replace-confirm, year balance).
