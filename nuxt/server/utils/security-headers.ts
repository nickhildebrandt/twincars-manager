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
}

/** Ob die Anwendung wirklich über HTTPS ausgeliefert wird. */
export const isHttps = (origin: string): boolean =>
  origin.trim().toLowerCase().startsWith('https://')

/**
 * Die Inhaltsrichtlinie.
 *
 * `'unsafe-inline'` bei den Skripten ist **kein Versehen** und auch keine
 * Bequemlichkeit: Nuxt legt den Zustand der Seite beim serverseitigen Rendern
 * als eingebettetes Skript ab. Ohne diese Erlaubnis hydriert die Seite nicht,
 * und die Anwendung ist unbedienbar. Der saubere Weg wäre ein Einmalwert je
 * Antwort (`nonce`), den Nuxt an dieses Skript schreibt — dafür gibt es in
 * Nuxt 4.5 keinen Haken. Festgehalten als **W-03** in blocker.md.
 *
 * Was `'unsafe-inline'` hier bedeutet und was nicht: es erlaubt eingebettete
 * Skripte **aus der eigenen Auslieferung**. Fremde Quellen bleiben gesperrt
 * (`script-src 'self'`), und ohne eine Lücke, durch die jemand HTML einschleust,
 * gibt es kein eingebettetes Skript, das nicht von hier stammt. Vue setzt jeden
 * Wert als Text, nicht als HTML.
 *
 * `style-src` braucht es ebenfalls: Nuxt UI und die Übergänge setzen Stile am
 * Element.
 */
export function contentSecurityPolicy(options: HeaderOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ['\'self\''],
    'base-uri': ['\'self\''],
    'form-action': ['\'self\''],
    'frame-ancestors': ['\'none\''],
    'object-src': ['\'none\''],
    'script-src': ['\'self\'', '\'unsafe-inline\''],
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
