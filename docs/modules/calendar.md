---
title: Module - calendar (Kalender)
tags: [module, calendar]
updated: 2026-07-10
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
- **Tables**: `calendar_entries` (kind `appointment` | `closure`); grid
  also UNIONs `employee_absences`. Public holidays are **computed** by
  `holiday-service.ts` since 2026-07 (the `public_holidays` table is
  dormant) - [[holidays]].
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
- **No order-creation shortcut in the calendar view** (2026-07): the
  grid toolbar no longer links to `/orders/new`. Instead the Termin
  form (`CalendarForm.svelte`, create mode) shows two clearly SEPARATED
  cross-module card groups below the form: "Werkstattauftrag" (link to
  `/orders/new` - workshop jobs are created as Aufträge, not as
  Termine) and "Urlaub & Krankheit" (link to `/employees` - absences
  are maintained on the employee detail and appear in the calendar
  automatically). Never intermingled with the form fields.
- **Appointment ↔ order**: the appointment edit page offers "Auftrag
  erstellen" (`createWorkOrderFromAppointmentRemote`, one order per
  Termin) and turns into a "Zum Auftrag" link once the order exists.
- **Public booking**: appointments can also be created by the website
  through `POST /api/public/appointments` (tire-change services only,
  free slots from `workshop_hours` minus closures) - [[public-rest-api]].
- **Tests**: `calendar-service.test.ts` (incl. holiday events and
  active sick/other absence events), `CalendarForm.test.ts`,
  `e2e/calendar.spec.ts` (holiday chip, separated form groups,
  employee filter).
