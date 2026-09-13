---
title: Anlegen aus einem Formular heraus
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Anlegen aus einem Formular heraus

Der Fall: im Auftragsformular fehlt der Kunde. Der Nutzer öffnet die
Kundenauswahl, findet ihn nicht, drückt „Neu anlegen" — und landet auf der
**vollständigen** Kundenseite. Danach steht er wieder im Auftrag, mit allem
was er schon getippt hatte, und der neue Kunde ist ausgewählt.

Zurück zum [Komponentenkatalog](README.md).

## Keine Schnellanlage

Eine Mini-Maske im Dialog legt einen halben Datensatz an, den später jemand
suchen und vervollständigen muss. Es geht auf die richtige Seite, mit allen
Feldern und allen Prüfungen.

## Ablauf

```ts
const flow = useCreationFlow()

function startCustomerCreation() {
  const ok = flow.start({
    returnTo: route.fullPath,
    entity: 'Kunde',
    field: 'customerId',
    state: { ...form }
  })
  if (ok) navigateTo('/customers/new')
}
```

Auf der Zielseite: `flow.finish(neueKennung)` nach dem Speichern,
`flow.cancel()` beim Abbrechen. Beides kehrt zurück; `finish` hängt
`?neu_<feld>=<kennung>` an, und das Ausgangsformular wählt den neuen Datensatz
damit selbst aus.

## Was im Entwurf steht — und was nicht

**Keine Binärdaten.** Felder, deren Name auf eine Datei hindeutet, `Blob`,
`ArrayBuffer` und alles, was mit `data:` beginnt, werden weggelassen. Der
Vorgänger legte Fotos als Base64 mit ab, überschritt damit stumm das
Speicherlimit des Browsers und fiel auf reinen Arbeitsspeicher zurück — ein
Neuladen verlor dann alles, ohne Hinweis (B-111).

Lässt sich der Entwurf nicht sichern, ist das eine **Meldung**, kein
Schweigen: „Der Zwischenstand konnte nicht gesichert werden. Legen Sie den
Datensatz an und kehren Sie zurück, ohne die Seite neu zu laden."

## Grenzen

| Grenze      | Wert     | Warum                                                                   |
| ----------- | -------- | ----------------------------------------------------------------------- |
| Haltbarkeit | 1 Stunde | Ein Formular von gestern wiederherzustellen verwirrt mehr, als es hilft |
| Tiefe       | 3        | Anlegen im Anlegen im Anlegen führt nirgendwohin                        |
| Schleife    | verboten | Einen Kunden aus einem Kunden anzulegen ergibt keinen Sinn              |

`activeEntities()` nennt, was gerade in der Kette steckt. Die Auswahl blendet
„Neu anlegen" damit aus, statt eine Absage zu zeigen.

Das Rücksprungziel läuft durch `safeRedirectTarget()`: nur Pfade dieser
Anwendung, nie eine fremde Adresse.

## Der Speicher ist eine Bequemlichkeit

Beschädigt, gesperrt oder voll — in allen drei Fällen wird neu angefangen und
nichts gemeldet, außer beim Sichern. Ein Entwurf ist kein Datenbestand.

## Geprüft wird das so

`test/nuxt/use-creation-flow.test.ts`: was im Entwurf landet, was nicht, wann
er verfällt, Tiefe, Schleife, Rücksprungziel, und dass ein volles
Speicherlimit eine Meldung erzeugt.
