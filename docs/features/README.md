---
title: Funktionen
kategorie: features
status: umgesetzt
updated: 2026-09-13
---

# Funktionen

Eine Seite je Funktion, mit stabiler Kennung `F-001` … `F-631`. Die Kennungen
ändern sich nie; Arbeitspakete, Tests und Doku beziehen sich auf genau sie.

Zurück zur [Übersicht](../index.md).

## Aufbau einer Seite

Zweck · Erwartetes Verhalten · Nutzersicht · Berechtigungen · Zustände ·
technischer Bezug (Routen, Endpoints, Tabellen, Schemata, Tests) · bekannte
Grenzen · Quellen.

`status` sagt, woran man ist:

| Status | Bedeutung |
| --- | --- |
| `geplant` | Verhalten aus dem Inventar übernommen, noch nicht umgesetzt |
| `umgesetzt` | in der Nuxt-Fassung vorhanden und getestet |
| `blockiert` | Umsetzung hängt, siehe `blocker.md` im Plan |

## Nach Bereich

Die Zuordnung Funktion → Modul → Arbeitspaket steht in der
[Abdeckungstabelle](../rewrite/06-abdeckung.md).

| Bereich | Kennungen |
| --- | --- |
| Plattform, Shell, Login, Dashboard, Suche | F-001 – F-054 |
| Authentifizierung, Berechtigungen, Benutzer | F-055 – F-094 |
| Gemeinsame Komponenten und Picker | F-095 – F-137 |
| Setup und Firmeneinstellungen | F-138 – F-177 |
| Kunden und Lieferanten | F-178 – F-220 |
| Fahrzeuge und Bestand | F-221 – F-256 |
| Artikel, Reifen, Reifenlager | F-257 – F-311 |
| Aufträge | F-312 – F-366 |
| Belege und PDF | F-367 – F-413 |
| E-Mail und Erinnerungen | F-414 – F-447 |
| Buchhaltung | F-448 – F-480 |
| Personal und Zeiten | F-481 – F-526 |
| Kalender | F-527 – F-556 |
| Öffentliche API, Beiträge, Anfragen | F-557 – F-587 |
| eBay und Legacy-Import | F-588 – F-631 |

## Vollständigkeit

`pnpm docs:check` bricht ab, sobald eine Kennung aus dem
[Inventar](../rewrite/01-inventar.md) keine Seite hat.
