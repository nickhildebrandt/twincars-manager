---
title: Public holidays - computed, no year limit
tags: [architecture, holidays, calendar, absences]
updated: 2026-07-10
---

# German public holidays - computed at read time

Since 2026-07 public holidays are **computed algorithmically** by
`src/lib/server/services/holiday-service.ts` instead of being read from
a seeded table. The former static 2026-2028 seed (`seed-holidays.ts`)
is gone; the `public_holidays` table still exists in the schema but is
**dormant** - nothing reads or writes it, and dropping it is left to a
future migration ([[database-schema]]).

## The service

- **Easter**: `easterSundayIso(year)` - Gauss Easter algorithm in the
  Meeus/Jones/Butcher form, pure integer arithmetic, guarded to
  1583-4099. All movable feasts (Karfreitag, Ostermontag, Christi
  Himmelfahrt, Pfingstmontag, Fronleichnam) derive from it.
  `bussUndBettagIso(year)` computes Buß- und Bettag (the Wednesday
  strictly before November 23).
- **State coverage**: `GermanState` is the ISO 3166-2:DE code of one of
  the 16 Bundesländer plus the pseudo-state `'DE'` = federal holidays
  only (the fallback for an unknown/unset company Bundesland).
- **Reads**: `getPublicHolidays(year, state)`,
  `getPublicHolidaysInRange(fromIso, toIso, state)` (both return
  `PublicHolidayEntry { date, name }[]`) and
  `isPublicHoliday(dateIso, state)`.
- **Company state resolution**: `resolveGermanState(freeText)` parses
  the free-text `company_settings.state` with ISO-code and alias
  tolerance; `getCompanyHolidayState()` reads the company row and
  resolves it, falling back to `'DE'` (federal-only).

## Deliberate caveats (documented in the module JSDoc)

Communal-only holidays are **excluded** - the service implements
state-wide statutory rules only:

- Fronleichnam in Sachsen / Thüringen (only selected municipalities) -
  SN/TH do NOT include it.
- Mariä Himmelfahrt in Bayern (only Catholic-majority municipalities) -
  BY does NOT include it; it IS state-wide in the Saarland.
- The Augsburger Friedensfest (city of Augsburg) is out of scope.

Buß- und Bettag is included for Sachsen only.

## Consumers

- [[calendar]] - `calendar-service.ts` emits `public_holiday` events
  into the month grid.
- [[employees]] - `absence-service.ts` business-day math: absence
  workday counts skip weekends AND the company Bundesland's holidays
  (`absenceWorkdays`, `checkVacationBudget`).
- [[public-rest-api]] - `public-api-service.ts` free-slot computation
  excludes holidays.

## Tests

`holiday-service.test.ts` - 38 known-answer tests incl. published
Easter dates (2026-04-05, 2028-04-16, 2035-03-25), 300-year invariants
(Easter is always a Sunday in March/April) and year boundaries.

Related: [[calendar]], [[employees]], [[public-rest-api]],
[[database-schema]].
