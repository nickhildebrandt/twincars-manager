---
title: Module - calendar (Kalender)
tags: [module, calendar]
updated: 2026-07-07
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
  `employee_sick`, `employee_other`, `hu_due`, `work_order`.
- **Work-order source** (the sixth derived source): ALL scheduled work
  orders (`scheduledDate` in range) appear as `work_order` events,
  regardless of status and origin. Open/in-progress orders get a
  `bg-secondary/10 text-secondary` badge; completed ones carry
  `done: true` and render muted
  (`bg-secondary/5 text-base-content/50 line-through`). To avoid double
  rendering, an appointment with a linked order is excluded from the
  appointment source (the order chip replaces the Termin chip). Events
  click through to `/orders/[id]`; the source honors the month view's
  employee filter (assignees). Timed placement uses the optional
  `scheduledTime` (HH:MM); timeless orders behave like all-day chips.
  See [[orders]].
- **Employee filter**: the month-view toolbar carries an optional
  employee picker that narrows appointments (entry employee), absences
  and work orders (assignee) to one employee; the shared sources
  (holidays, closures, HU) stay visible.
- **"Neuer Auftrag" action**: the grid toolbar links to `/orders/new`
  (workshop jobs are created as Aufträge, not as Termine), and
  `/calendar/new` shows an info hint ("Werkstattarbeit geplant?") with
  the same link above the Termin form.
- **Appointment ↔ order**: the appointment edit page offers "Auftrag
  erstellen" (`createWorkOrderFromAppointmentRemote`, one order per
  Termin) and turns into a "Zum Auftrag" link once the order exists.
- **Public booking**: appointments can also be created by the website
  through `POST /api/public/appointments` (tire-change services only,
  free slots from `workshop_hours` minus closures) - [[public-rest-api]].
- **Tests**: `calendar-service.test.ts`.
