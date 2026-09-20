/**
 * Eine Web-`Request` aus einem h3-Ereignis — auch wenn der Rumpf schon gelesen
 * wurde.
 *
 * `toWebRequest` baut die Anfrage aus dem **Strom**. Der ist einmalig: hat ihn
 * vorher jemand gelesen, kommt bei der Bibliothek ein leerer Rumpf an, und die
 * Anmeldung scheitert mit einer Meldung, die nichts mit der Ursache zu tun hat.
 *
 * Genau das passiert hier: die Anmeldedrossel muss wissen, auf welches Konto
 * gezielt wird (M-36), und liest den Rumpf deshalb vor dem Endpoint. h3 legt
 * das Ergebnis ab, also wird die Anfrage daraus neu zusammengesetzt statt aus
 * dem verbrauchten Strom.
 */
import { getRequestHeaders, getRequestURL, readBody } from 'h3'
import type { H3Event } from 'h3'

/** Methoden, die keinen Rumpf tragen. */
const WITHOUT_BODY = new Set(['GET', 'HEAD'])

export async function toWebRequestWithBody(event: H3Event): Promise<Request> {
  const method = event.method.toUpperCase()
  const headers = new Headers(getRequestHeaders(event) as Record<string, string>)

  if (WITHOUT_BODY.has(method)) {
    return new Request(getRequestURL(event), { method, headers })
  }

  const body = await readBody(event).catch(() => undefined)
  const payload = body === undefined ? undefined : JSON.stringify(body)

  // Die Länge stimmt nach dem Neuaufbau nicht mehr; sie stehen zu lassen führt
  // zu einer Anfrage, die sich selbst widerspricht.
  headers.delete('content-length')
  if (payload !== undefined) headers.set('content-type', 'application/json')

  return new Request(getRequestURL(event), { method, headers, body: payload })
}
