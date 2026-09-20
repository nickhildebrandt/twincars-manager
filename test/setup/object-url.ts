/**
 * `URL.createObjectURL` für happy-dom, damit Dateivorschauen nicht abstürzen.
 *
 * Nuxt UI erzeugt in `UFileUpload` eine Vorschau über `URL.createObjectURL`.
 * happy-dom bringt die Funktion mit, prüft aber gegen **seinen eigenen**
 * `Blob` — und eine Datei aus Nodes `File`-Klasse besteht diese Prüfung
 * nicht:
 *
 *   TypeError: The "obj" argument must be an instance of Blob.
 *              Received an instance of File
 *
 * Das ist eine Lücke der Testumgebung, kein Fehler der Anwendung: im Browser
 * läuft es. Statt die Anwendung umzubauen, damit sie in happy-dom durchgeht —
 * etwa die Vorschau abzuschalten —, wird hier die eine fehlende Funktion
 * gestellt. Eine Adresse, die niemand öffnet; geprüft wird, was die Anwendung
 * mit der Datei macht, nicht wie die Vorschau aussieht.
 *
 * Der Browsertest (`test/browser/`) läuft in echtem Chromium und braucht das
 * nicht.
 */
let counter = 0

const objectUrls = new Map<string, unknown>()

if (typeof URL !== 'undefined') {
  URL.createObjectURL = (value: unknown): string => {
    const url = `blob:twincars/${++counter}`
    objectUrls.set(url, value)
    return url
  }

  URL.revokeObjectURL = (url: string): void => {
    objectUrls.delete(url)
  }
}
