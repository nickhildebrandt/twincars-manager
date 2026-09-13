# Rewrite von TwinCarsManager auf Nuxt — Übersicht

Dieser Ordner enthält den vollständigen Plan für den Umbau der Anwendung von
**SvelteKit** auf **Nuxt**. Er ist so geschrieben, dass eine Sitzung ohne
Vorwissen ihn allein abarbeiten kann.

> **Der Plan ist verbindlich.** Wo er mit vorgefundenem Code kollidiert,
> gewinnt der Plan. Die neue Anwendung entsteht in `nuxt/`; der alte Bestand
> unter `src/` ist read-only.

## Wo anfangen

| Wenn Sie … | lesen Sie |
| --- | --- |
| umsetzen wollen | **[07-ausfuehrung.md](07-ausfuehrung.md)** — Schritt für Schritt, dann [06-arbeitsplan.md](06-arbeitsplan.md) |
| wissen wollen, was die Anwendung können muss | [01-inventar.md](01-inventar.md) |
| wissen wollen, was am Vorgänger kaputt ist | [02-befunde.md](02-befunde.md) |
| eine technische Entscheidung brauchen | [03-architektur.md](03-architektur.md), [08-entscheidungen.md](08-entscheidungen.md) |
| wissen wollen, wie sich etwas bedienen soll | [04-ux.md](04-ux.md) |
| einen Test schreiben | [05-teststrategie.md](05-teststrategie.md) |
| den Stand sehen wollen | [fortschritt.md](fortschritt.md), [blocker.md](blocker.md) |

## Die Dateien

| Datei | Inhalt |
| --- | --- |
| [01-inventar.md](01-inventar.md) | **Feature-Matrix** des Bestands: 631 Features mit stabilen IDs (`F-001`…). Das ist die Spezifikation des Zielverhaltens. |
| [`inventar/`](inventar/) | Ausführliche Modul-Inventare (17 Dateien): Routen, Endpoints, Services, Komponenten, Abläufe, Nebenwirkungen, Tests — mit Fundstellen im alten Code. Dazu die beiden Recherchedateien zum Stack und zur Authentifizierung. |
| [02-befunde.md](02-befunde.md) | **617 Befunde**: Fehler, Inkonsistenzen, fehlende Validierung, Leistungs- und Sicherheitsprobleme, unfertige Stellen. |
| [03-architektur.md](03-architektur.md) | Zielarchitektur: Stack mit geprüften Versionen, Ordnerstruktur, Server-Schichten, Valibot-Konzept, Datenhaltung, Auth, Oberfläche, CI, Deployment, Doku-Regeln. |
| [04-ux.md](04-ux.md) | UX-Parität: Routen, Toasts, Animationsdauern, Pagination, Zustände, Formularregeln, Bausteinzuordnung, **15 Golden Flows**, begründete Abweichungen. |
| [05-teststrategie.md](05-teststrategie.md) | Sechs Prüfebenen, Vitest-Projekte, echte Testdatenbank, Coverage-Schwellen, Regressionstests je Befund, Selektor-Konvention. |
| [06-arbeitsplan.md](06-arbeitsplan.md) | **42 Arbeitspakete** (`T-001`…) mit Vorbedingungen, Dateien, Akzeptanzkriterien, Tests. |
| [06-abdeckung.md](06-abdeckung.md) | **Abdeckungstabelle**: jede Feature-ID einem Arbeitspaket zugeordnet, jeder zu behebende Befund ebenso. |
| [07-ausfuehrung.md](07-ausfuehrung.md) | Anleitung für die umsetzende Sitzung, inklusive Entwurf für `nuxt/CLAUDE.md`. |
| [08-entscheidungen.md](08-entscheidungen.md) | Getroffene Entscheidungen, Annahmen und die offenen Punkte samt Vorgehen ohne Antwort. |
| [fortschritt.md](fortschritt.md) | Ein Eintrag je abgeschlossenem Paket. |
| `blocker.md` | Wird angelegt, sobald ein Akzeptanzkriterium nicht erreichbar ist. |

## Die Zahlen

| Größe | Wert |
| --- | --- |
| Feature-IDs | **631** |
| davon einem Arbeitspaket zugeordnet | **631** (100 %) |
| Befunde | **617** |
| davon „im Rewrite beheben" | 429 — jeder bekommt einen Regressionstest |
| davon „bewusst später" | 39 |
| davon „Entscheidung nötig" | 149 |
| Arbeitspakete | **42** in drei Phasen |
| Golden Flows | **15** |
| Module im Inventar | 17 |

## Wie der Plan entstanden ist

Der gesamte Bestand wurde gelesen, nicht überflogen: 438 Quelldateien,
33 000 Zeilen Service-Code, 8 700 Zeilen Server-Schnittstelle, 31 000 Zeilen
Oberfläche, 38 Migrationen, die vorhandene Wissensbasis und alle
Architekturentscheidungen. Jede Modul-Datei unter [`inventar/`](inventar/)
schließt mit der Liste der dafür gelesenen Dateien.

Die Versionen des Ziel-Stacks wurden am 2026-09-12 gegen die
Paketregistrierung und die offizielle Dokumentation geprüft, nicht aus dem
Gedächtnis übernommen — Einzelheiten in
[`inventar/research-stack.md`](inventar/research-stack.md) und
[`inventar/research-auth.md`](inventar/research-auth.md).

## Die harten Regeln in einem Absatz

pnpm ausschließlich. ESLint formatiert, Prettier kommt nicht vor. Kein eigenes
CSS — eine Stylesheet-Datei, Aussehen über Nuxt UI und `app.config.ts`.
Nuxt-Bordmittel vor Fremdpaketen. Valibot an jeder Grenze, ein Schema pro
Sache, Typen abgeleitet. Guard als erste Anweisung in jedem Endpoint.
Serverseitige Pagination, fest 25. Toast bei jeder Mutation. Mehrfachauswahl im
modalen Dialog. Animationen mit `prefers-reduced-motion`. `data-testid` oder
Rolle als Testselektor. Transaktion, sobald mehr als eine Anweisung schreibt.
Tests und Dokumentation gehören zum Arbeitspaket — ohne sie ist nichts fertig.
