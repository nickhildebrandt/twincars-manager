# 04 — Zwei Abnahmekriterien reiten auf späteren Paketen mit

**Betrifft:** T-009 (Kriterien 3 und 6) · **Stand:** **entschieden am
20.09.2026** — angenommen, bleiben vermerkt

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


---

## Entschieden am 20.09.2026 — angenommen, und Kriterium 6 wird größer

Beide Kriterien bleiben als offen vermerkt und werden mit den Paketen
nachgewiesen, die die echten Seiten bringen. Dazu zwei Festlegungen:

**Das Anlegen muss über mehr als zwei Ebenen funktionieren.**

> „Beim Anlegen eines Kunden direkt eine Ebene tiefer ein Fahrzeug anlegen, von
> dort ggf. noch tiefer. Denkbare Ketten: Rechnung → Kunde, oder Auftrag →
> Rechnung → Kunde → Fahrzeug. Das ist Spekulation: prüfe, inwiefern das
> UI-technisch und vom Flow her sinnvoll ist. Abgebildet werden muss es auf
> jeden Fall."

**Die Prüfung dazu.** „Auftrag → Rechnung → Kunde → Fahrzeug" ist als Kette
nicht sinnvoll: eine Rechnung entsteht aus einem **fertigen** Auftrag, nicht
aus einem Picker im Auftragsformular. Die Ketten, die wirklich vorkommen, sind
höchstens drei Ebenen tief — die Tabelle dazu steht jetzt in T-009 des
Arbeitsplans. Der Stapel begrenzt die Tiefe trotzdem nicht künstlich; er
zählt, und der Schleifenschutz verhindert nur dieselbe Art zweimal im Stapel.

Kriterium 6 lautet deshalb jetzt **drei** Ebenen, dazu zwei neue Kriterien:
„Abbrechen" führt eine Ebene zurück, und der Schleifenschutz greift.

**Voller Testumfang.**

> „Sehr wichtiger Punkt: vollumfängliche Testabdeckung mit Unit-Tests,
> Integrationstests, Komponententests, Regressionstests, End-to-End-Tests und
> Accessibility-Tests … Nuxt UI wird ganz normal verwendet, ohne große
> Anpassungen: kein Custom CSS, kein Zusammenfrickeln von Komponenten."

Steht als eigener Abschnitt in T-009.
