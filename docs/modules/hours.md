---
title: Module - hours (Stundenerfassung)
tags: [module, hours, time-tracking]
updated: 2026-07-05
---

# hours - "Stunden" (time tracking)

- **Purpose**: employees log work effort (hours per day, optionally
  linked to a document or customer); managers see everyone, reports and
  utilization. Replaced the removed payroll module (migration 0015).
- **Routes**: `/hours` (list; "Alle" tab only for full-`hours` holders),
  `/hours/new`, `/hours/[id]`, `/hours/[id]/edit`, `/hours/reports`
  (monthly report / utilization).
- **Remote** `hours.remote.ts`: `listTimeEntriesRemote`,
  `getTimeEntryRemote`, `createTimeEntryRemote`,
  `updateTimeEntryRemote`, `deleteTimeEntryRemote`,
  `utilizationSummaryRemote`, `monthlyReportRemote`,
  `currentEmployeeRemote`, `canReadAllHoursRemote`.
- **Permissions - the one two-level module**
  ([[adr-002-per-module-permissions]]): guards use
  `requireAnyPermission('hours', 'hours:write_own')`; holders of only
  `hours:write_own` are scoped to their own employee record
  (`callerCanReadAll` requires full `hours`). Sidebar entry keys on
  `hours:write_own` so self-service users see it.
- **Services**: `time-entry-service.ts`, `workshop-hours-service.ts`.
- **Tables**: `time_entries` (numeric `hours`, e.g. 1.50 = 1h30m -
  effort, not punch-clock; optional documentId/customerId), `employees`,
  `workshop_hours`.
- **Tests**: `time-entry-service.test.ts`,
  `workshop-hours-service.test.ts`, `hours.remote.test.ts` (permission
  scoping), `HoursForm.test.ts`.
