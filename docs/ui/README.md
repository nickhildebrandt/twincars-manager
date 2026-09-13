---
title: Komponenten
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Komponenten

Katalog der eigenen Komponenten. Fremdkomponenten aus Nuxt UI sind hier nicht
beschrieben — dafür gibt es deren eigene Dokumentation.

Zurück zur [Übersicht](../index.md).

## Grundsätze

- Eigene Komponenten sind **dünne Schalen um Nuxt UI**, die ein Muster
  festschreiben: Liste, Tabelle, Formular, Auswahl, Bestätigung.
- **Kein eigenes CSS.** Aussehen kommt aus dem Theme in `app/app.config.ts`;
  Tailwind-Klassen nur für Layout.
- Jede Komponente reicht `data-testid` durch, damit Tests nicht auf interne
  Klassen zugreifen müssen.

## Aufbau einer Seite

Zweck · Props · Ereignisse · Slots · Zustände (leer, ladend, Fehler) ·
Tastaturbedienung · Verwendungsbeispiel · Nuxt-UI-Grundlage.

## Animationen

Dauern und Kurven sind festgelegt und gelten überall gleich; sie stehen in den
[UX-Vorgaben](../rewrite/04-ux.md). `prefers-reduced-motion` wird respektiert.

## Die Seiten

| Seite                               | Inhalt                                                |
| ----------------------------------- | ----------------------------------------------------- |
| [Die Anwendungshülle](app-shell.md) | Leiste, Kopfzeile, Schublade, Ladeanzeige, Navigation |

Weitere Komponenten entstehen mit den fachlichen Paketen.
