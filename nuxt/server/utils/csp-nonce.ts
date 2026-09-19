/**
 * Der Einmalwert für die Inhaltsrichtlinie.
 *
 * Je Antwort einer. Er steht in der Richtlinie (`script-src 'nonce-…'`) und an
 * jedem eingebetteten Skript, das der Server selbst hineingeschrieben hat.
 * Damit läuft genau das und sonst nichts — ein eingeschleustes Skript kennt
 * den Wert nicht, denn er wird gewürfelt und nirgends wiederverwendet.
 */
import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

declare module 'h3' {
  interface H3EventContext {
    /** Der Einmalwert dieser Antwort, gesetzt vom Kopfzeilen-Zwischenstück. */
    cspNonce?: string
  }
}

/**
 * 16 zufällige Bytes, base64.
 *
 * Die Empfehlung lautet mindestens 128 Bit aus einer kryptographischen
 * Quelle. `Math.random()` wäre hier wertlos: wer den Wert vorhersagen kann,
 * hat die Richtlinie ausgehebelt.
 */
export const newNonce = (): string => randomBytes(16).toString('base64')

/** Der Einmalwert dieser Antwort, falls einer vergeben wurde. */
export const nonceOf = (event: H3Event): string | undefined => event.context.cspNonce

/**
 * Die Teile des Dokuments, die der Rahmen selbst erzeugt.
 *
 * Bewusst **ohne `body`**: dort steht der gerenderte Seiteninhalt. Ein
 * `<script>`, das über eine Lücke dort hineingeraten ist, bekäme durch einen
 * Stempel genau die Erlaubnis, die ihm die Richtlinie verweigern soll — die
 * Maßnahme höbe sich selbst auf.
 *
 * Diese Liste ist die Sicherheitsgrenze; deshalb steht sie benannt da und
 * nicht als Zeichenkette in einem Schleifenkopf.
 */
export const FRAMEWORK_PARTS = ['head', 'bodyPrepend', 'bodyAppend'] as const

/** Setzt `nonce` an jedes `<script`, das noch keines hat. */
export function stampNonce(markup: string, nonce: string): string {
  return markup.replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
}
