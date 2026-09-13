---
id: F-582
title: Anfragen-Posteingang
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/settings/inquiries']
endpoints: ['listInquiriesRemote']
tables: ['customer_inquiries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-582 — Anfragen-Posteingang

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Anfragen-Posteingang

## Erwartetes Verhalten

Filter Alle/Ausstehend/Versendet/Fehlgeschlagen (auf `notification_status`), Pagination 25, `created_at DESC`; Spalten Eingegangen/Von/Betreff/Bezug/Benachrichtigung/Aktion; Fehlertext + Sendezeit; kein Detail, keine Statuspflege, keine Suche

## Nutzersicht

_Wird mit T-030 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-030 ergänzt._

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
| Routen | `/settings/inquiries` |
| Endpoints | `listInquiriesRemote` |
| Tabellen | `customer_inquiries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-582 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
