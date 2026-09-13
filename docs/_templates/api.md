---
title: Kurzbeschreibung des Endpoints
kategorie: api
method: GET
path: /api/beispiel
permission: modulschlüssel
status: geplant
features: ['F-000']
updated: JJJJ-MM-TT
---

# GET /api/beispiel

Ein Satz: was der Endpoint liefert oder tut.

## Berechtigung

`requirePermission(event, 'modul')` — ohne Sitzung 401, ohne Recht 403.

## Eingabe

Schema: `beispielQuerySchema` in `shared/schemas/beispiel.ts`

| Feld | Typ | Pflicht | Regel |
| ---- | --- | ------- | ----- |

## Ausgabe

```json
{}
```

## Fehler

| Status | Bedingung        | Nachricht                                        |
| ------ | ---------------- | ------------------------------------------------ |
| 401    | keine Sitzung    | Bitte melden Sie sich an.                        |
| 403    | Recht fehlt      | Sie haben keine Berechtigung für diesen Bereich. |
| 404    | unbekannte Id    | … nicht gefunden.                                |
| 422    | Eingabe ungültig | Bitte prüfen Sie Ihre Eingaben.                  |

## Beispiel

```bash
curl -s http://localhost:3000/api/beispiel
```

## Bezug

- Funktion: [F-000](../features/F-000-beispiel.md)
