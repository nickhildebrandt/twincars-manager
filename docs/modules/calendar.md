---
title: Module - calendar (Kalender)
tags: [module, calendar]
updated: 2026-07-05
---

# calendar - "Kalender"

- **Purpose**: month grid + appointment list; unified entries for
  "Termin" and "Betriebsschließung"; overlays holidays and employee
  absences.
- **Routes**: `/calendar` (grid + Termine table), `/calendar/new`
  (single form card, kind select switches sections),
  `/calendar/[id]/edit`.
- **Remote** `calendar.remote.ts`: `listCalendarEventsRemote` (month
  feed), `listAppointmentsRemote` (`kind='appointment'` table),
  `getCalendarEntryRemote`, `createCalendarEntryRemote`,
  `updateCalendarEntryRemote`, `deleteCalendarEntryRemote`,
  `findOverlappingAppointmentsRemote`. Guard
  `requirePermission('calendar')`.
- **Service**: `calendar-service.ts` (merged; the old
  appointment-service is gone - [[adr-011-unified-calendar-entries]]).
- **Tables**: `calendar_entries` (kind `appointment` | `closure`),
  `public_holidays`; grid also UNIONs `employee_absences`.
- **Validation invariants** (enforced in the remote inputSchema, not
  the DB): appointment needs status
  scheduled/completed/cancelled and optional customer/vehicle/employee
  links; closure forces `allDay=true` and null status/links;
  `endsAt >= startsAt`.
- **Event kinds emitted to the grid**: `appointment`,
  `business_closure`, `public_holiday`, `employee_vacation`,
  `employee_sick`, `employee_other`.
- **Public booking**: appointments can also be created by the website
  through `POST /api/public/appointments` (tire-change services only,
  free slots from `workshop_hours` minus closures) - [[public-rest-api]].
- **Tests**: `calendar-service.test.ts`.
