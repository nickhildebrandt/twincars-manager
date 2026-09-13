---
title: Bestätigen
kategorie: ui
status: umgesetzt
updated: 2026-09-13
---

# Bestätigen

Ein Dialog für die ganze Anwendung, geöffnet über `useConfirm()`, nie direkt.

Zurück zum [Komponentenkatalog](README.md).

```ts
const confirm = useConfirm()

if (
  !(await confirm({
    title: 'Kunde archivieren?',
    description:
      'Er verschwindet aus Listen und Auswahlen, bleibt aber erhalten.',
    confirmLabel: 'Archivieren',
    tone: 'error',
    details: ['3 Fahrzeuge', '7 Rechnungen']
  }))
)
  return
```

## Warum ein Versprechen und kein Rückruf

So steht der Abbruch im Code dort, wo die Handlung steht — eine Zeile, die man
beim Lesen nicht übersieht. Der Vorgänger hatte neun Stellen mit selbstgebauten
Dialogen, von denen nur drei den Fokus fingen und auf Escape reagierten
(B-108).

## Eigenschaften

| Name           | Vorgabe      | Bedeutung                                   |
| -------------- | ------------ | ------------------------------------------- |
| `title`        | —            | die Frage, als Frage                        |
| `description`  | —            | was passiert, in einem vollständigen Satz   |
| `confirmLabel` | `Bestätigen` | besser das Verb der Handlung: „Archivieren" |
| `cancelLabel`  | `Abbrechen`  |                                             |
| `tone`         | `primary`    | `error` für alles Unwiderrufliche           |
| `details`      | `[]`         | die Aufzählung dessen, was mitgeht          |

## Wegklicken heißt Nein

Escape, der Schließen-Knopf und ein Klick daneben liefern `false`. Ein Dialog,
der beim Schließen bestätigt, wäre eine Falle — der Aufrufer prüft nur auf
„wahr".

## Zugänglichkeit

Fokusfang, Escape und die Rückgabe des Fokus kommen von Nuxt UI; genau deshalb
gibt es keinen zweiten, selbstgebauten Dialog. `UApp` trägt `:locale="de"` —
sonst heißt die Schließen-Schaltfläche „Close" mitten in einer deutschen
Oberfläche.

## Testselektoren

`confirm-dialog`, `confirm-accept`, `confirm-cancel`, `confirm-description`,
`confirm-details`.

## Geprüft wird das so

`test/nuxt/use-confirm.test.ts` prüft die Antwort in allen drei Wegen
(bestätigen, abbrechen, schließen), die Beschriftungen, den Titel als
Dialogüberschrift und zwei Fragen hintereinander.
`test/browser/dialogs.test.ts` prüft Fokus und Tastatur im echten Browser.
