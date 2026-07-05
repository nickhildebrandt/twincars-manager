---
title: Business overview - TwinCast
tags: [domain, business]
updated: 2026-07-05
---

# Business overview

**TwinCast** is a small German Kfz business (Kfz-Werkstatt) with three legs:

1. **Werkstatt** (workshop): repairs, maintenance, HU/AU handling for
   customer vehicles. Billing via "Rechnungen" and "Angebote /
   Kostenvoranschläge" ([[document-types]]).
2. **Reifenhandel** (tire trade): a dedicated tire catalog ([[tires]]) sold
   locally and (planned) via [[ebay]]; the public website lists sellable
   tires through the [[public-rest-api]]. Seasonal "Reifeneinlagerung"
   (customer tire storage, [[tire-storage]]) with QR-labelled storage slots
   and twice-yearly tire-change reminder mails.
3. **Gebrauchtwagenhandel** (used cars): vehicles bought into stock,
   listed ([[inventory]]), advertised with a one-click A4 "Verkaufsschild"
   PDF, and sold - including "Differenzbesteuerung" (§25a UStG) support.

**TwinCarsManager** is the SvelteKit web app that runs the whole business.
It is the successor to a legacy Microsoft Access database ("Kfz-Kaufmann"),
whose data is migrated by the [[kfz-kaufmann-import]]. The primary users are
**not technical**; the UI is entirely German, calm and predictable
(see `CONTRIBUTING.md` §1).

## Key business rules baked into the app

- **Single friendly "Zahlungserinnerung"** - no escalation, no "Mahngebühr",
  no "Verzugszinsen". The same template is re-sent every
  `reminderRecurEveryDays` (default 14) days until paid ([[reminders]]).
- **GoBD**: issued invoices are never deleted; corrections go through a
  "Storno-Rechnung" ([[adr-015-storno-instead-of-delete]]).
- **§19 UStG Kleinunternehmerregelung** is supported via
  `company_settings.smallBusinessExempt` (affects invoice PDFs and
  [[xrechnung]] output).
- **Legacy number continuity**: after an import, `number_ranges` continue
  from max(legacy)+1 so document numbers stay legally consistent.
- **Online booking is restricted to tire-change services**: only `items`
  rows flagged `onlineBookable` can be booked through the public API;
  everything else is arranged by phone.
- **Opt-in communication**: broadcasts only go to customers with
  `wantsBroadcast`; tire reminders only with `wantsTireReminders`
  ([[smtp-mail]], [[mailings]]).

## Deployment reality

One production instance at `https://tc.ts13.de:5443` (manager) next to the
marketing website at `https://tc.ts13.de` - see [[deployment]]. Single
tenant, single Postgres, no HA. The company website consumes the
[[public-rest-api]] (tires, used cars, services, appointments, posts,
contact form).

Related: [[entities]], [[glossary]], [[business-overview]] neighbours in
[[INDEX]].
