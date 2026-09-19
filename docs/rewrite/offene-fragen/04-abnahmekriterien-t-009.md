# 04 — Zwei Abnahmekriterien reiten auf späteren Paketen mit

**Betrifft:** T-009 (Kriterien 3 und 6) · **Stand:** bewusst mitgenommen, nicht
abgeschwächt

## Worum es geht

T-009 hat neun Abnahmekriterien. Sieben sind vollständig nachgewiesen. Zwei
verlangen einen Durchlauf über **echte Seiten**, und die gab es zu dem
Zeitpunkt noch nicht.

## Kriterium 3 — „Neuladen stellt Filter und Seite wieder her"

**Nachgewiesen ist beides für sich:**

- dass jede Änderung wirklich in die Adresszeile geschrieben wird und einen
  Eintrag im Verlauf hinterlässt (Browsertest, echter Router, echtes Chromium);
- dass eine Liste aus einer gegebenen Adresse denselben Zustand herstellt
  (Komponententest).

**Nicht nachgewiesen** ist der Durchlauf mit echtem Neuladen. Der Grund ist
technisch: `@nuxt/test-utils/browser` hängt jede Anwendung auf der Startadresse
ein und liest `window.location` beim zweiten Einhängen nicht erneut.

**Wo es nachgeholt wird:** Golden Flow G-03 in T-011, an der ersten echten
Liste.

## Kriterium 6 — „Creation-Flow über zwei Ebenen stellt den Entwurf wieder her"

**Nachgewiesen ist die gesamte Mechanik:** Stapel über zwei Ebenen, Rücksprung
mit Kennung, Schleifenschutz, Verfall nach einer Stunde, volles Speicherlimit
als Meldung.

**Nicht nachgewiesen** ist der Weg über zwei echte Formularseiten.

**Wo es nachgeholt wird:** Golden Flow G-04 in T-012.

## Was hier zu entscheiden wäre

Nichts — außer, ob Sie das so akzeptieren. Ich halte es fest, damit es nicht
als „erledigt" durchrutscht. Beide Kriterien stehen in `fortschritt.md` unter
T-009 ausdrücklich als offen.
