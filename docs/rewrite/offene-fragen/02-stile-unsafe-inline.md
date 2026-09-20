# 02 — Die Stile behalten `'unsafe-inline'`

**Betrifft:** M-40, P-21 · **Stand:** **entschieden am 20.09.2026** — bleibt so

## Worum es geht

Die Inhaltsrichtlinie sagt dem Browser, woher Skripte und Stile kommen dürfen.
Bei den **Skripten** steht seit dem 17.09.2026 ein Einmalwert je Antwort — es
läuft genau das, was der Server selbst hineingeschrieben hat.

Bei den **Stilen** steht weiterhin `'unsafe-inline'`.

## Warum

Nuxt UI und die Seitenübergänge setzen Stile als **Attribut am Element**
(`style="…"`), nicht als `<style>`-Block. Ein Einmalwert deckt Attribute nicht
ab — dafür gäbe es nur `'unsafe-hashes'`, und das erlaubt dann jeden Stil, der
zu einem der hinterlegten Prüfwerte passt. Das ist keine Verbesserung, sondern
eine unübersichtlichere Form derselben Erlaubnis.

## Wie groß der Hebel ist

Eingeschleustes CSS kann eine Seite verunstalten, Inhalte verdecken oder eine
Schaltfläche über eine andere legen. Es kann **keinen Code ausführen** und
keine Daten abrufen — `connect-src` steht auf `'self'`, Bilder und Schriften
ebenso. Der Abstand zu eingeschleustem JavaScript ist groß.

Voraussetzung für einen Angriff bliebe außerdem, dass jemand überhaupt HTML
einschleusen kann. Vue setzt jeden Wert als Text; dafür bräuchte es ein
`v-html` mit fremden Daten, und davon gibt es keines.

## Was zur Wahl steht

**A — so lassen**, dokumentiert.

**B — auf `<style>`-Blöcke umstellen** und einen Einmalwert auch dort setzen.
Das hieße, Nuxt UI und die Übergänge daran zu hindern, Stile am Element zu
setzen — ein Kampf gegen die Komponentenbibliothek, den man dauerhaft führt.

## Empfehlung

**A**, mit einer Wiedervorlage, falls Nuxt UI eines Tages ohne
Attribut-Stile auskommt.


---

## Entschieden am 20.09.2026 — es bleibt

> „`'unsafe-inline'` für Stile bleibt bestehen und wird dokumentiert. Bei
> solchen tiefen Themen wird nicht im Framework herumgefummelt. Es gilt der
> Standard, den Nuxt vorgibt."

Damit ist die Einschränkung keine Lücke mehr, sondern eine festgelegte Grenze.
Sie steht in `server/utils/security-headers.ts` im Kopfkommentar und hier.
Sollte Nuxt UI eines Tages ohne Stil-Attribute auskommen, ist es eine Zeile —
bis dahin wird nichts nachgebaut.
