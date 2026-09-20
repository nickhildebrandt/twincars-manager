# Blocker und offene Werkzeugfragen

Dinge, die nicht aus der Anwendung kommen, sondern aus den Werkzeugen — und
die jemand irgendwann wieder entfernen sollte. Fachliche Entscheidungen stehen
in [08-entscheidungen.md](08-entscheidungen.md), fachliche Befunde in
[02-befunde.md](02-befunde.md).

Kein echter Blocker offen. Ein Werkzeugproblem ist umgangen:

---

## W-01 — Das Browser-Projekt scheitert bei kaltem Vite-Zwischenspeicher

**Gefunden:** 2026-09-13, Arbeitspaket T-007 · **Zustand:** umgangen, Ursache
liegt im Werkzeug

**Was passiert.** Ist `node_modules/.cache/vite` nicht vorhanden, scheitert das
Browser-Projekt, bevor ein einziger Test läuft:

```
Error: Failed to import test file test/setup/browser.ts
Caused by: Error: Vitest failed to find the runner.
  ❯ beforeEach .../deps/plugins.Cigb0uSy-D4Y62LXd.js?v=87a1bd18:4166:35
  ❯ .../@nuxt/test-utils/dist/browser/index.mjs?v=87a1bd18:9:1
  ❯ runSetupFiles .../deps/plugins.Cigb0uSy-D4Y62LXd.js?v=048a0cfb:5528:35
```

**Warum.** Die beiden `?v=`-Werte im Aufrufpfad sind verschieden. Vite
optimiert die Abhängigkeiten, entdeckt währenddessen eine weitere, optimiert
erneut und lädt die Seite neu. Die Aufbaudatei — `@nuxt/test-utils/browser`
meldet beim Laden ein `beforeEach` an — hält danach die **vorige** Ausgabe von
Vitest fest, in der kein Runner eingetragen ist. Der zweite Lauf gelingt immer,
weil der Zwischenspeicher dann vollständig ist.

**Reproduktion**

```bash
cd nuxt
rm -rf node_modules/.cache/vite
pnpm exec vitest run --project browser   # scheitert
pnpm exec vitest run --project browser   # gelingt
```

**Was nicht geholfen hat.** `optimizeDeps.exclude` für `@nuxt/test-utils`;
`optimizeDeps.include` derselben Pakete (der Browser verbindet sich dann gar
nicht mehr); `optimizeDeps.holdUntilCrawlEnd`;
`server.deps.inline`; die Aufbaudatei in eine eigene Quelldatei kapseln;
`--no-file-parallelism`.

**Wie es umgangen ist.** `pnpm test`, `pnpm test:browser` und `pnpm test:cov`
rufen über ihren `pre…`-Schritt `scripts/warm-vite-cache.mjs` auf. Das Skript
lässt das Browser-Projekt vorlaufen, wenn der Zwischenspeicher fehlt oder
veraltet ist. Drei Dinge musste es dazu lernen:

- **Je Variante.** Coverage bringt ein zusätzliches Plugin mit, und ein Plugin
  ändert den Fingerabdruck des Optimierers: ein ohne Coverage gewärmter
  Zwischenspeicher ist für `pnpm test:cov` wieder kalt. Der Vorlauf läuft
  deshalb mit denselben Schaltern wie der Lauf, den er vorbereitet, und hat je
  Variante eine eigene Marke.
- **Ein geänderter Browsertest zählt.** Ein neuer Import dort zieht eine
  Abhängigkeit herein, die der Optimierer noch nicht kennt — und wirft ihn
  mitten im Lauf neu an. `test/browser/` und `test/setup/` gelten deshalb wie
  `vitest.config.ts`, `nuxt.config.ts`, `package.json` und `pnpm-lock.yaml`.
- **Bis er durchgeht, höchstens dreimal.** Bricht der Vorlauf selbst an genau
  diesem Neuladen ab, ist der Zwischenspeicher danach halb gebaut und der
  eigentliche Lauf wieder der erste kalte. Die Marke wird erst nach einem
  sauberen Durchgang geschrieben.

Der eigentliche Lauf findet danach einen vollständigen Zwischenspeicher; ist er
bereits frisch, kostet die Prüfung nichts.

**Wichtig:** Es wird kein Test übersprungen und keiner entschärft. Jeder Test
läuft danach und muss bestehen. Die Umgehung kostet beim ersten Lauf einer
frischen Arbeitskopie etwa vier Sekunden.

**Wann es weg kann.** Sobald Vitest oder `@nuxt/test-utils` den Neuladevorgang
behebt. Dann alle `pretest…`-Schritte aus `package.json` und
`scripts/warm-vite-cache.mjs` entfernen und die Reproduktion oben noch
einmal durchspielen.

**Betroffene Fassungen:** Vitest 5.0.0, `@vitest/browser-playwright` 5.0.0,
`@nuxt/test-utils` 4.3.2, Vite über Nuxt 4.5.2.

---

## W-02 — Die Segmente des Datumsfeldes heißen für den Screenreader englisch

**Stand:** 13.09.2026 · **Betrifft:** T-009 · **Schwere:** klein, nicht
umgangen

**Was passiert.** `UInputDate` (Nuxt UI 4.11.1 über Reka UI) baut ein Datum aus
drei Segmenten. Mit `:locale="de"` an `UApp` stimmen **Reihenfolge und
Trenner**: `01.03.2026`, Tag vor Monat, Punkt als Trenner. Die
`aria-label`-Werte der Segmente bleiben aber englisch — `day,`, `month,`,
`year,` — und die Vorlesehilfe eines Monats lautet `1 - January`.

**Warum es hier steht.** Die Oberfläche ist deutsch. Ein Screenreader liest an
dieser einen Stelle englisch vor.

**Warum es nicht umgangen wird.** Reka UI erzeugt diese Beschriftungen im
Inneren der Komponente; es gibt keine Eigenschaft dafür. Die einzigen Wege
wären, nach dem Rendern im DOM herumzuschreiben oder die Komponente
nachzubauen. Beides wäre schlimmer als der Mangel: Regel 4 sagt Nuxt UI zuerst,
und ein nachgebautes Datumsfeld verliert Tastaturbedienung, Fokusführung und
Zeitzonenfestigkeit — also genau das, wofür die Komponente da ist.

**Was stattdessen abgesichert ist.** `test/nuxt/form-fields.test.ts` nagelt die
Reihenfolge Tag–Monat–Jahr und den Punkt als Trenner fest. Das ist der Teil,
an dem ein Fehler Daten verfälscht: `01/03/2026` und `01.03.2026` bezeichnen
zwei verschiedene Tage.

**Wann es weg kann.** Sobald Reka UI die Segmentbeschriftungen aus der
Sprachdatei nimmt. Dann die Zusage in `test/nuxt/form-fields.test.ts` um die
deutschen `aria-label`-Werte erweitern und diesen Eintrag streichen.

**Betroffene Fassungen:** Nuxt UI 4.11.1, Reka UI in der davon gezogenen
Fassung.

---

## W-03 — Die Inhaltsrichtlinie braucht `'unsafe-inline'` für Skripte · `behoben am 17.09.2026`

> **Behoben — und der Eintrag war von Anfang an falsch begründet.** Er
> behauptete, Nuxt biete keinen Haken, um einen Einmalwert an seine
> eingebetteten Skripte zu schreiben. Den Haken gibt es: `render:html`, und die
> Nuxt-Dokumentation beschreibt **genau diesen Fall** als seinen Zweck. Die
> Behauptung stammte aus einer Annahme, nicht aus einer Prüfung.
>
> Umgesetzt in `server/utils/csp-nonce.ts` und `server/plugins/20.csp-nonce.ts`:
> das Kopfzeilen-Zwischenstück würfelt je Antwort 16 zufällige Bytes, die
> Richtlinie trägt `script-src 'self' 'nonce-…'`, und der Haken schreibt den
> Wert an jedes eingebettete Skript des Rahmens. `'unsafe-inline'` steht damit
> gar nicht mehr in der ausgelieferten Richtlinie — es wäre in Anwesenheit
> eines Einmalwerts ohnehin wirkungslos.
>
> **Was beim Umsetzen beinahe schiefgegangen wäre.** Der erste Entwurf
> stempelte auch `body` — den **gerenderten Seiteninhalt**. Ein `<script>`, das
> über eine Lücke dort hineingeraten wäre, hätte durch den Stempel genau die
> Erlaubnis bekommen, die ihm die Richtlinie verweigern soll. Die Maßnahme
> hätte sich selbst aufgehoben. Gestempelt wird jetzt nur, was der Rahmen
> selbst erzeugt: `head`, `bodyPrepend`, `bodyAppend`. Die Liste heißt
> `FRAMEWORK_PARTS` und hat einen eigenen Test, der festhält, dass `body` nicht
> darin steht.
>
> **Nachgewiesen wird es am echten Build** (`test/e2e/ssr.test.ts`): die
> Richtlinie trägt einen Einmalwert, jede Antwort einen anderen, **jedes**
> eingebettete Skript trägt genau diesen — und die Seite hydriert.
>
> Offen bleibt nur `style-src 'unsafe-inline'`; das steht als eigene Frage in
> [offene-fragen/](offene-fragen/README.md).

<details>
<summary>Der ursprüngliche Eintrag</summary>

**Stand:** 17.09.2026 · **Betrifft:** T-044 (M-40, P-21) · **Schwere:** mittel,
nicht umgangen

**Was passiert.** Nuxt legt beim serverseitigen Rendern den Zustand der Seite
als **eingebettetes Skript** ab (`window.__NUXT__`). Eine Inhaltsrichtlinie mit
`script-src 'self'` allein verbietet das: der Browser führt das Skript nicht
aus, die Seite hydriert nicht, und die Anwendung ist unbedienbar. Deshalb steht
dort `'self' 'unsafe-inline'`.

**Was das bedeutet — und was nicht.** Erlaubt sind eingebettete Skripte **aus
der eigenen Auslieferung**. Eine fremde Quelle bleibt gesperrt (`'self'`, kein
Platzhalter, kein `http:`), `object-src` ist `'none'`, `base-uri` und
`form-action` sind `'self'`. Ein eingebettetes Skript kann also nur dorthin
kommen, wo jemand HTML einschleust — und Vue setzt jeden Wert als Text, nicht
als HTML. Die Lücke ist real, aber schmal, und sie verlangt vorher eine andere.

**Warum es nicht umgangen wird.** Der saubere Weg ist ein Einmalwert je Antwort
(`nonce`), den der Server erzeugt und Nuxt an sein eigenes Skript schreibt.
Nuxt 4.5 bietet dafür **keinen Haken**; das Skript entsteht tief im Renderer.
Die beiden Auswege wären:

- `@nuxtjs/security` als Fremdpaket — es macht genau das. Regel 4 sagt aber:
  Eigenbau vor Fremdpaket, und das Paket bringt zwei Dutzend weitere
  Einstellungen mit, die niemand hier gelesen hat.
- Die Antwort nachträglich umschreiben und das Skript mit einem `nonce`
  versehen — ein Eingriff in fremdes HTML bei jeder Antwort. Das ist genau die
  Art Trick, die beim nächsten Versionssprung still zerbricht.

**Was stattdessen abgesichert ist.** `test/unit/security-headers.test.ts` nagelt
fest, dass **keine fremde Quelle** und kein Platzhalter in `script-src` steht
und dass `'unsafe-eval'` im Betrieb fehlt. `test/e2e/ssr.test.ts` prüft am
echten Build, dass die Kopfzeilen ankommen und die Seite trotzdem hydriert.

**Wann es weg kann.** Sobald Nuxt einen `nonce` für seine eigenen eingebetteten
Skripte unterstützt. Dann in `contentSecurityPolicy()` `'unsafe-inline'` durch
`'nonce-…'` ersetzen, den Wert je Anfrage erzeugen und diesen Eintrag
streichen.

**Betroffene Fassungen:** Nuxt 4.5.2, Nitro in der davon gezogenen Fassung.

</details>


---

## W-04 — Unovis zeichnet nicht in happy-dom

**Festgestellt:** 20.09.2026 · **Stand:** umgangen, nicht behoben ·
**Betrifft:** M-35, T-009

**Was passiert.** `nuxt-charts` (E-25) zeichnet über **Unovis**, und Unovis
fasst das DOM unmittelbar an: es hängt einen `MutationObserver` an den Tooltip
und lässt einen gedrosselten Zeitgeber laufen. In happy-dom — der Umgebung des
`nuxt`-Testprojekts — bricht beides, und zwar in **beide** Richtungen:

| Was man tut | Was kommt |
| --- | --- |
| die Komponente stehen lassen | `ReferenceError: document is not defined` in `_Tooltip._setContainerPosition`, **nach** dem Ende des Laufs — alle Tests grün, der Lauf trotzdem rot |
| die Komponente abbauen | `TypeError: Cannot read private member #listeners` in happy-doms `MutationObserver.disconnect` |

Der erste Fall ist der unangenehmere: er zählt als „unhandled error", nicht
als fehlgeschlagener Test. Wer nur auf die Zahl der grünen Tests sieht, hält
den Lauf für in Ordnung.

**Was stattdessen gilt.** Die Verlaufskurve wird im **Browser-Projekt**
geprüft (`test/browser/trend-chart.test.ts`, echtes Chromium), nicht im
`nuxt`-Projekt. Das ist keine Abschwächung, sondern die richtige Ebene: ein
Diagramm ist eine Sache des Browsers, und genau dafür gibt es das Projekt.

**Was ausdrücklich nicht getan wurde.** Kein Stopfen von `document` in
happy-dom, kein Abschalten des Tooltips, kein `vi.mock` auf Unovis. Jede
dieser Krücken hätte die Anwendung für die Testumgebung verbogen — und die
Prüfung wäre danach eine über die Krücke gewesen.

**Wann es weg kann.** Sobald Unovis seinen Zeitgeber beim Abbau abräumt und
happy-dom `MutationObserver.disconnect` über einen Proxy verträgt. Dann kann
`test/browser/trend-chart.test.ts` zurück zu den übrigen Anzeigekomponenten
wandern. Bis dahin kostet es nichts außer einer Datei an anderer Stelle.

**Betroffene Fassungen:** `@unovis/ts` 1.7.0, `@unovis/vue` 1.7.0,
happy-dom 20.14.5.
