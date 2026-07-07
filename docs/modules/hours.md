---
title: Module - hours (Stundenerfassung)
tags: [module, hours, time-tracking]
updated: 2026-07-07
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
  effort, not punch-clock; optional documentId/customerId, plus
  workOrderId/workOrderItemId back-links for order write-through rows),
  `employees`, `workshop_hours`.
- **Work-order integration** ([[orders]]): the list shows an "Auftrag"
  column and accepts a `workOrderId` deep-link filter
  (`/hours?workOrderId=<uuid>`). Entries written through from a work
  order (workOrderItemId set) are read-only **everywhere** - on
  `/hours` AND on the invoice detail's time-entry table, which shows an
  "Auftrag" badge instead of a delete action; mutations 409 with
  "Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt." and
  are edited at the order instead. Utilization/monthly reports include
  order hours unchanged; they count as billable once the order is
  completed (completion back-fills `time_entries.document_id` with the
  generated invoice).
- **Tests**: `time-entry-service.test.ts`,
  `workshop-hours-service.test.ts`, `hours.remote.test.ts` (permission
  scoping), `HoursForm.test.ts`.
