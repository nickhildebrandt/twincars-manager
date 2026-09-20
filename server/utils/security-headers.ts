/**
 * Die Sicherheits-Kopfzeilen, als reine Rechnung (M-40).
 *
 * Getrennt vom Zwischenstück, damit sie prüfbar ist: eine Richtlinie, die ein
 * nötiges Ziel vergisst, zeigt sich hier und nicht erst als weiße Seite im
 * Browser.
 */

export type HeaderOptions = {
  /** Die eigene Adresse, z. B. `https://twincars.example`. */
  origin: string
  /** Im Entwicklungsbetrieb braucht Vite mehr Freiheiten. */
  development?: boolean
  /**
   * Der Einmalwert dieser Antwort.
   *
   * Ist er gesetzt, tritt er an die Stelle von `'unsafe-inline'`: nur die
   * Skripte, die **diesen** Wert tragen, laufen. Ein eingeschleustes Skript
   * kennt ihn nicht — er wird je Antwort neu gewürfelt.
   */
  nonce?: string
}

/** Ob die Anwendung wirklich über HTTPS ausgeliefert wird. */
export const isHttps = (origin: string): boolean =>
  origin.trim().toLowerCase().startsWith('https://')

/**
 * Die Inhaltsrichtlinie.
 *
 * **Skripte.** Eine Seite von Nuxt trägt vier eingebettete `<script>`: die
 * Importkarte, das Farbschema-Skript von Nuxt UI, die Laufzeitkonfiguration
 * und den Seitenzustand. Nur das letzte ist ein reiner Datenblock
 * (`type="application/json"`) und wird nie ausgeführt — die anderen drei
 * schon. Eine Richtlinie mit `script-src 'self'` allein verbietet sie alle
 * drei, und die Seite hydriert nicht.
 *
 * Deshalb der **Einmalwert**: `server/plugins/20.csp-nonce.ts` würfelt je
 * Antwort einen Wert, schreibt ihn an jedes eingebettete Skript, und hier
 * steht er in der Richtlinie. Damit läuft genau das, was der Server selbst
 * hineingeschrieben hat. Ein eingeschleustes Skript kennt den Wert nicht —
 * und `'unsafe-inline'` verliert in Anwesenheit eines Einmalwerts ohnehin
 * seine Wirkung, weshalb es dann gar nicht erst dasteht.
 *
 * Im **Entwicklungsbetrieb** bleibt `'unsafe-inline'`: dort fügt Vite eigene
 * Skripte ein, die nicht durch den Nuxt-Haken laufen. Der Betrieb ist der
 * Ernstfall, und der bekommt den Einmalwert.
 *
 * **Stile.** `style-src` behält `'unsafe-inline'`. Nuxt UI und die Übergänge
 * setzen Stile als `style`-Attribut am Element, und ein Einmalwert deckt
 * Attribute nicht ab — dafür gäbe es nur `'unsafe-hashes'`, und das ist keine
 * Verbesserung. Eingeschleustes CSS ist ein deutlich kleinerer Hebel als
 * eingeschleustes JavaScript.
 */
export function contentSecurityPolicy(options: HeaderOptions): string {
  const inlineScripts = options.nonce
    ? [`'nonce-${options.nonce}'`]
    : ['\'unsafe-inline\'']

  const directives: Record<string, string[]> = {
    'default-src': ['\'self\''],
    'base-uri': ['\'self\''],
    'form-action': ['\'self\''],
    'frame-ancestors': ['\'none\''],
    'object-src': ['\'none\''],
    'script-src': ['\'self\'', ...inlineScripts],
    'style-src': ['\'self\'', '\'unsafe-inline\''],
    'img-src': ['\'self\'', 'data:', 'blob:'],
    'font-src': ['\'self\'', 'data:'],
    'connect-src': ['\'self\''],
    'worker-src': ['\'self\'', 'blob:'],
    'manifest-src': ['\'self\''],
    'media-src': ['\'self\'', 'blob:'],
  }

  if (options.development) {
    // Vite hält im Entwicklungsbetrieb eine Websocket-Verbindung für das
    // Neuladen und wertet Module zur Laufzeit aus.
    directives['connect-src']!.push('ws:', 'wss:')
    directives['script-src']!.push('\'unsafe-eval\'')
  }
  else {
    // Im Betrieb: alles, was doch über http käme, wird auf https gehoben.
    directives['upgrade-insecure-requests'] = []
  }

  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ')
}

/**
 * Alle Kopfzeilen, fertig zum Setzen.
 *
 * `Strict-Transport-Security` **nur über HTTPS**. Auf einer Entwicklungs- oder
 * Testinstanz über http gesetzt, sperrt sie den Browser für Monate aus der
 * eigenen Anwendung aus — und zwar so, dass es niemand ohne Handarbeit im
 * Browserprofil wieder löst.
 */
export function securityHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': contentSecurityPolicy(options),

    // Kein Raten des Inhaltstyps. Ohne das macht ein Browser aus einer
    // hochgeladenen „Bilddatei" mit Skriptinhalt unter Umständen ein Skript.
    'X-Content-Type-Options': 'nosniff',

    // Kein Einbetten in eine fremde Seite. `frame-ancestors` in der
    // Inhaltsrichtlinie sagt dasselbe; diese Zeile erreicht ältere Browser.
    'X-Frame-Options': 'DENY',

    // Interne Adressen verlassen die Anwendung nicht. Eine Adresszeile wie
    // `/customers/9f1c…` verrät sonst beim nächsten fremden Aufruf, welche
    // Datensätze es gibt.
    'Referrer-Policy': 'same-origin',

    // Was diese Anwendung nicht braucht, bekommt sie auch nicht.
    'Permissions-Policy': [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',
    ].join(', '),

    // Eine fremde Seite, die dieses Fenster öffnet, behält keinen Zugriff.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',

    // Eine Verwaltungsanwendung gehört in keinen Suchindex und in kein Archiv.
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  }

  if (isHttps(options.origin)) {
    // Zwei Jahre, samt Unterbereichen. Ohne HTTPS bewusst nicht gesetzt.
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
  }

  return headers
}
