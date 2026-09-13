---
title: Der Formularrahmen
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Der Formularrahmen

`FormPage` ist der Rahmen jedes Formulars: Titel, Felder, Fehlerzusammenfassung,
Speicherleiste. Vier Zusagen aus den [UX-Vorgaben](../rewrite/04-ux.md) §3.8
stehen darin an **einer** Stelle, damit sie nicht in vierzig Formularen je
einmal getroffen werden müssen.

Zurück zum [Komponentenkatalog](README.md).

```vue
<FormPage
  title="Kunde bearbeiten"
  :errors="fieldErrors"
  submit-label="Speichern"
  cancel-to="/customers"
  @submit="save"
>
  <UFormField label="Nachname" name="lastName" required>
    <UInput v-model="form.lastName" name="lastName" />
  </UFormField>
</FormPage>
```

## Speichern wird nie wegen der Eingaben gesperrt

Ein Knopf, der sich wegen fehlender Eingaben abschaltet, sagt dem Bediener
nicht, **was** fehlt. Er probiert, klickt, nichts passiert. Also bleibt der
Knopf anklickbar; geprüft wird beim Klick, und die Antwort ist eine Liste.

Gesperrt wird nur von zweierlei:

| Grund         | Bedeutung                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------- |
| `busy.active` | Es läuft schon eine Anfrage. Schutz gegen Doppel-Absenden.                                |
| `locked`      | Ein echter Riegel — ein ausgestellter Beleg, eine Systemrolle. `lockedReason` sagt warum. |

## Die Fehlerzusammenfassung

Oben, in Rot, mit **deutschen Feldnamen** aus `shared/schemas/field-labels.ts`
— nicht mit `lastName`. Eine Position in einer Liste heißt „Menge (Position 3)".

Jeder Eintrag ist ein **Verweis auf sein Feld**: ein Klick setzt den Fokus
dorthin und scrollt hin. Bei vierzig Feldern ist eine Liste, die nur aufzählt,
keine Hilfe.

Die Feldfehler kommen entweder aus der Prüfung beim Klick oder aus der
422-Antwort des Servers — dieselbe Form, `{ pfad: 'deutscher Satz' }`, also
dasselbe Aussehen.

## `novalidate`

Steht fest am Formular. Sonst zeigt der Browser seine eigenen Blasen, auf
Englisch, an einer Stelle, die niemand gestaltet hat.

## Ungespeicherte Änderungen

Kommen aus `useFormDirty()`, nicht aus dieser Komponente: der Wächter gilt für
die Seite, nicht für den Rahmen. Wichtig bleibt die Reihenfolge —
`markSaved()` **vor** dem Weiterleiten, sonst bricht die Abfrage die eigene
Navigation ab (B-038).

## Testselektoren

`form`, `form-submit`, `form-cancel`, `form-errors`, `form-error-<pfad>`,
`form-locked`.

## Geprüft wird das so

`test/nuxt/form-page.test.ts`: dass Feldfehler den Knopf **nicht** sperren,
dass eine laufende Anfrage und ein Riegel es tun, dass die Liste deutsche
Namen zeigt und zum Feld führt.
