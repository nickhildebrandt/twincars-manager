/**
 * Eine Web-Anfrage aus einem h3-Ereignis, auch nach gelesenem Rumpf.
 *
 * Der Strom einer Anfrage lässt sich nur einmal lesen. Die Anmeldedrossel liest
 * ihn, um zu wissen, auf welches Konto gezielt wird (M-36) — danach käme bei
 * der Anmeldebibliothek ein leerer Rumpf an, und sie antwortete mit einer
 * Meldung, die nichts mit der Ursache zu tun hat.
 */
import { describe, expect, it } from 'vitest'
import { createApp, defineEventHandler, readBody, toWebHandler } from 'h3'
import { installNitroGlobals, TEST_ORIGIN } from '../setup/nitro-globals'

installNitroGlobals()

const { toWebRequestWithBody } = await import('../../server/utils/web-request.ts')

/** Baut eine Anwendung, die den Rumpf zuerst liest und dann neu aufbaut. */
function buildApp(readFirst: boolean) {
  const app = createApp()
  app.use(defineEventHandler(async (event) => {
    if (readFirst) await readBody(event).catch(() => undefined)
    const rebuilt = await toWebRequestWithBody(event)
    return {
      method: rebuilt.method,
      contentType: rebuilt.headers.get('content-type'),
      hasContentLength: rebuilt.headers.has('content-length'),
      body: rebuilt.body ? await rebuilt.text() : null,
    }
  }))
  return toWebHandler(app)
}

const call = (readFirst: boolean, init: RequestInit = {}) =>
  buildApp(readFirst)(new Request(`${TEST_ORIGIN}/probe`, init))

describe('toWebRequestWithBody', () => {
  it('gibt den Rumpf zurück, obwohl er schon gelesen wurde', async () => {
    const response = await call(true, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mmustermann' }),
    })
    expect(await response.json()).toMatchObject({
      method: 'POST',
      body: '{"username":"mmustermann"}',
    })
  })

  it('funktioniert auch, wenn niemand vorher gelesen hat', async () => {
    const response = await call(false, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    })
    expect(await response.json()).toMatchObject({ body: '{"a":1}' })
  })

  it('trägt keine Länge mehr, die nicht mehr stimmt', async () => {
    // Eine Anfrage mit falscher Längenangabe widerspricht sich selbst.
    const response = await call(true, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mmustermann' }),
    })
    expect(await response.json()).toMatchObject({ hasContentLength: false })
  })

  it('lässt eine Anfrage ohne Rumpf in Ruhe', async () => {
    const response = await call(false, { method: 'GET' })
    expect(await response.json()).toMatchObject({ method: 'GET', body: null })
  })

  it('verträgt einen unlesbaren Rumpf, statt die Anfrage zu verlieren', async () => {
    const response = await call(false, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'das ist kein JSON',
    })
    expect(response.status).toBe(200)
  })
})
