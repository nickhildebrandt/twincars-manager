---
id: F-611
title: Live-Fortschritt
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: ['getImportProgressRemote().run()']
tables: ['access_import_jobs']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-611 — Live-Fortschritt

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Live-Fortschritt

## Erwartetes Verhalten

1-s-Poll; Box `role="status" aria-live="polite"` mit Label + `n %` + `<progress>`; Startwert „Import wird gestartet …" 0 %; Jobs älter als 60 s vor Klick ignoriert; Poll-Fehler ignoriert; Stop im `finally` und bei Unmount

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

## Zustände

| Zustand | Verhalten |
| --- | --- |
| Leer | _offen_ |
| Laden | _offen_ |
| Fehler | _offen_ |
| Keine Berechtigung | _offen_ |

## Technischer Bezug

| | |
| --- | --- |
| Routen | `/settings/import` |
| Endpoints | `getImportProgressRemote().run()` |
| Tabellen | `access_import_jobs` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-611 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
