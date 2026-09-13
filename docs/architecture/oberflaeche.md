---
title: Oberfläche
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Oberfläche

Wie die Anwendung aufgebaut ist, und welche Regeln dabei nicht verhandelbar
sind.

Zurück zur [Architektur](README.md) ·
[Die Anwendungshülle](../ui/app-shell.md)

## Kein eigenes CSS

Genau **eine** Stilvorlage: `app/assets/css/main.css`. Sie enthält die beiden
Pflicht-Importe, die Design-Tokens und die Übergänge. `<style>`-Blöcke in
Komponenten gibt es nicht.

Aussehen und Varianten kommen aus `app/app.config.ts`. Tailwind-Klassen dienen
dem Layout und sonst nichts.

## Zustand: was wo liegt

| Zustand                   | Ort               | Regel                                               |
| ------------------------- | ----------------- | --------------------------------------------------- |
| Wer angemeldet ist        | `useAuthState()`  | einmal beim Rendern gefüllt, nie selbst entschieden |
| Was gerade lädt           | `useBusyState()`  | ein Zähler, keine lokalen Flags                     |
| Ungespeicherte Änderungen | `useDirtyState()` | ein Zustand für die ganze Anwendung                 |

Alle drei liegen in `useState`, damit der Server sie beim Rendern füllt und der
Browser sie übernimmt, statt beim ersten Bild nachzuladen. Ein zweiter Zähler
für dieselbe Sache ist der Anfang eines Fehlers, nicht eine Optimierung.

## Anfragen

`useApi()` ist der einzige erlaubte Weg zu `/api/**`. Es zählt jede Anfrage in
die Ladeanzeige, übersetzt 401 in eine Weiterleitung zur Anmeldung, reicht
Feldfehler an das Formular durch und zeigt für alles andere einen Toast mit dem
deutschen Satz, den der Server geschickt hat.

## Bewegung

Dauern und Kurven stehen in
[04-ux.md §3.2](../rewrite/04-ux.md) und als Tokens in `main.css`. Wer weniger
Bewegung wünscht, bekommt keine: keine Verschiebung, keine Skalierung.
Deckkraftwechsel bleiben, weil sie kein Bewegungsempfinden auslösen.

Keine Animation darf das Layout verschieben oder eine Eingabe verzögern.

## Testselektoren

`data-testid` oder eine Rolle mit zugänglichem Namen. **Nie** eine interne
Klasse von Nuxt UI — die ändert sich mit der nächsten Fassung, und dann bricht
der Test, ohne dass sich etwas Fachliches geändert hätte.

Der Selektor sitzt auf dem Element, das der Test bedient: bei einem Eingabefeld
also auf dem `<input>`, nicht auf dessen Umhüllung.

Siehe auch: [Anmeldung und Berechtigungen](auth.md) ·
[Serverschichten](server-schichten.md) · [Komponenten](../ui/README.md)
