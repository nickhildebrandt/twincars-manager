---
title: Module - employees (Mitarbeiter)
tags: [module, employees, hr]
updated: 2026-07-05
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
  `requirePermission('employees')`.
- **Services**: `employee-service.ts` (incl.
  `getEffectiveSalary(employeeId, dateIso)`), `absence-service.ts`
  (types vacation/sick/other, conflict detection,
  `remainingVacationDays` - currently a simple Mon-Fri workday count).
- **Tables**: `employees` (no salary columns since migration 0008),
  `employee_salary_versions`, `employee_absences` (optional attachment
  as base64, e.g. AU-Bescheinigung).
- **Special**:
  - Salaries follow the versioned-values convention
    ([[adr-007-price-snapshots-and-versions]]).
  - Absences feed the [[calendar]] month grid
    (employee_vacation/sick/other event kinds).
  - **Planned, not implemented**: carryover-aware Resturlaub with a
    reusable workday service (workshop hours + public holidays +
    closures) - approved design in
    `archive/specs/2026-06-23-employee-absences-vacation-design.md`.
    `employees` has no `vacation_carryover*` columns yet.
  - Payroll was removed (migration 0015) in favor of time tracking
    ([[hours]]).
- **Picker**: `pickEmployeesRemote`.
- **Tests**: `employee-service.test.ts`, `absence-service.test.ts`,
  `EmployeeForm.test.ts`.
