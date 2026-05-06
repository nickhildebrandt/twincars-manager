# Unified calendar entries

Refactor the calendar's "Neuer Eintrag" form from a tabbed two-table model
into a single normal form card backed by a single `calendar_entries` table.

## Motivation

`/calendar/new` currently uses DaisyUI `tabs-lift` to switch between two
disjoint forms — one for `appointments`, one for `business_closures`.
The form does not look like the other entity forms (customers, vehicles,
employees), and the calendar service has to UNION two tables on every
read. The legacy split is a side-effect of how the modules were
scaffolded; it does not reflect a real domain difference. Both records
are calendar entries with a start, an end, and a title.

## Out of scope

- Public holidays (`public_holidays`) and employee absences
  (`employee_absences`) stay in their own tables. They are populated by
  rules / employee records, not by the "Neuer Eintrag" form, and the
  unified table would become a junk drawer if we folded them in.
- Recurring appointments. Not in the requirements.
- Notifications, conflict detection, e-mail invites. Out of scope.

## Schema

Replace `appointments` and `business_closures` with one table:

```ts
export const calendarEntries = pgTable(
  'calendar_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: varchar('kind', { length: 20 }).notNull(), // 'appointment' | 'closure'
    title: varchar('title', { length: 200 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    status: varchar('status', { length: 20 }), // appointment-only
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'set null'
    }),
    employeeId: uuid('employee_id').references(() => employees.id, {
      onDelete: 'set null'
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(nowDefault)
  },
  (t) => [
    index('calendar_entries_kind_idx').on(t.kind),
    index('calendar_entries_starts_at_idx').on(t.startsAt)
  ]
)
```

### Validation rules (server-side, in the remote `inputSchema`)

- `kind = 'appointment'`:
  - `status` required, picklist `['scheduled', 'completed', 'cancelled']`,
    default `'scheduled'`.
  - `customerId`, `vehicleId`, `employeeId` all optional.
  - `allDay` boolean, default `false`.
  - When `allDay = true`, server normalises `startsAt` to `00:00:00` and
    `endsAt` to `23:59:59` of the user-provided dates.
- `kind = 'closure'`:
  - `allDay` forced to `true`. Reject if client sends `false`.
  - `status` must be `null`. Reject otherwise.
  - `customerId`, `vehicleId`, `employeeId` must all be `null`. Reject
    otherwise. (Form already disables them; this is the belt-and-braces
    server check.)
- Both kinds: `endsAt >= startsAt`. Title required, max 200.

### Migration

Single Drizzle migration (`npm run db:generate`):

1. `DROP TABLE appointments`
2. `DROP TABLE business_closures`
3. `CREATE TABLE calendar_entries (...)` with the schema above.
4. Indexes: `calendar_entries_kind_idx`, `calendar_entries_starts_at_idx`.

No data backfill — calendar/appointments is a stub-stage module per
`CLAUDE.md`; only customers and vehicles are end-to-end implemented.
Dropping the empty dev tables is safe.

## UI

### `/calendar/new`

One `<form class="card border border-base-300 bg-base-100">` with one
`<div class="card-body gap-4">`, identical structure to `CustomerForm`.
No tabs, no `tabs-lift`, no second card.

```
[ card ]
  Art *               [ Termin ▾ ] | [ Betriebsschließung ▾ ]      ← <select>
  Titel *             [____________________________________]

  ─── if kind = appointment ───
  ☐ Ganztägig
  Beginn * | Ende *   [ datetime-local ] | [ datetime-local ]      ← date inputs when Ganztägig=on
  Status              [ Geplant ▾ ]
  ─── Verknüpfungen ───
  Kunde | Fahrzeug | Mitarbeiter        (SearchablePicker × 3)

  ─── if kind = closure ───
  Von *    | Bis *    [ date ] | [ date ]                          ← Ganztägig implicit, no toggle
  (no status, no Verknüpfungen)

  Notiz               [ textarea ]

  [ Abbrechen ]  [ Speichern ]
```

Visible-section toggle is `{#if kind === 'appointment'}` / `{:else}`.
The kind select sits above the title so the user picks the entry type
first; everything below adapts. The Notiz textarea is shared.

DaisyUI components used: `select select-bordered`, `input input-bordered`,
`textarea textarea-bordered`, `checkbox checkbox-sm`, `btn btn-primary`,
`btn btn-ghost`, `card`, `card-body`, `fieldset`, `fieldset-legend`,
`alert alert-error` (for the validation message). All controls carry
`w-full` per `CONTRIBUTING.md` §11.

The "Urlaub oder Krankheit eintragen?" hint card stays below the form,
unchanged — it links to `/employees`.

### `/calendar` (list/grid page)

No structural change. The page already merges via `listCalendarEventsRemote`
which keeps a `kind` discriminator. Internally that query rewires from
the old two-table UNION to a single SELECT against `calendar_entries`
(plus the unchanged UNIONs for `public_holidays` and `employee_absences`).

The "Termine" list table below the grid keeps its current shape; its
query filters `where kind = 'appointment'`.

## Remote functions

Collapse into `src/routes/calendar/calendar.remote.ts`:

| Remote                      | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `listCalendarEventsRemote`  | Month-grid feed (existing). Internals rewired.           |
| `listAppointmentsRemote`    | Table on calendar page. `where kind='appointment'`.      |
| `createCalendarEntryRemote` | Single create, discriminated by `kind` in `inputSchema`. |
| `deleteCalendarEntryRemote` | Single delete.                                           |

Removed remotes: `createAppointmentRemote`, `deleteAppointmentRemote`,
`getPickersRemote` (only used by the old appointment form — the new form
uses `pickCustomersRemote`/`pickVehiclesRemote`/`pickEmployeesRemote`
from `pickers.remote.ts` like every other form),
`createBusinessClosureRemote`, `deleteBusinessClosureRemote`,
`listBusinessClosuresRemote`.

## Service layer

Merge `appointment-service.ts` and `calendar-service.ts` into one
`calendar-service.ts`:

- `listCalendarEvents(from, to, employeeId)` — month-grid feed.
- `listAppointments(params)` — paginated, filtered by `kind='appointment'`.
- `createCalendarEntry(input)` — discriminated insert.
- `deleteCalendarEntry(id)`.

The old `appointment-service.ts` and the old closure helpers in
`calendar-service.ts` go away.

## File-level changes

```
src/lib/server/db/schema.ts                                   modify (drop 2 tables, add calendar_entries)
src/lib/server/db/validation.ts                               (no change)
src/lib/server/services/calendar-service.ts                   rewrite (merged, single table)
src/lib/server/services/appointment-service.ts                delete
src/lib/server/services/calendar-service.test.ts              update
src/lib/server/services/appointment-service.test.ts           delete or merge into calendar-service.test.ts
src/routes/calendar/calendar.remote.ts                        rewrite (4 remotes)
src/routes/appointments/                                      delete entire dir
src/routes/calendar/+page.svelte                              rewire imports + remove unused appointment imports
src/routes/calendar/new/+page.svelte                          rewrite (one card, kind select, conditional sections)
drizzle/<NNNN>_unified_calendar_entries.sql                   new migration
```

## Verification

Per `CONTRIBUTING.md` §13 / project memory:

1. `npx svelte-check` — 0/0.
2. `npx vitest run` — full suite green; calendar/appointment service
   tests cover discriminated insert + read paths.
3. Playwright walk-through on `npm run dev`:
   - `/calendar/new` loads as one card. Kind selector shows
     "Termin" / "Betriebsschließung".
   - Pick "Termin" → fill title, leave Ganztägig off, set start/end,
     status, link a customer → save → toast "Termin angelegt." → land on
     `/calendar` → entry visible in grid AND in list table.
   - `/calendar/new` again → "Termin" + Ganztägig on → date inputs
     appear (no time portion) → save → entry spans the whole day in
     the grid.
   - `/calendar/new` again → "Betriebsschließung" → Ganztägig
     forced/hidden, links section hidden, status hidden → save →
     entry visible in grid (gray closure styling) but NOT in the
     "Termine" list table.
   - Server-side: posting `{ kind: 'closure', customerId: '...' }` via
     a hand-rolled fetch returns 400.
   - Delete one of each from the list/grid → both gone, refresh OK.
4. DaisyUI Blueprint MCP confirms each component (select, checkbox,
   datetime input, fieldset) before the markup is written.

## Risks / open questions

- The `getPickersRemote` (in `appointments.remote.ts`) is currently
  unused after the refactor. The new form uses
  `pickCustomersRemote`/`pickVehiclesRemote`/`pickEmployeesRemote` like
  every other form — consistent with the picker convention in
  `CONTRIBUTING.md`. Confirmed: removing it.
- Closure → appointment edits ("oh I picked the wrong type"): out of
  scope. The user creates a new entry of the right kind and deletes
  the wrong one. Edit pages aren't part of this scope.
- Existing calendar grid color-coding by `kind` keeps working because
  the `listCalendarEventsRemote` shape is unchanged — it still emits
  `{ id, title, dateIso, kind, employeeId? }` per day with `kind` ∈
  `{ appointment, business_closure, public_holiday, employee_vacation,
employee_sick, employee_other }`. The internal SELECT changes; the
  output shape doesn't.
