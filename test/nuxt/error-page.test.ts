import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ErrorPage from '~/error.vue'

const mount = (error: Record<string, unknown>) =>
  mountSuspended(ErrorPage, { props: { error } as never })

describe('Fehlerseite', () => {
  it('zeigt für 404 einen verständlichen deutschen Satz', async () => {
    const page = await mount({ statusCode: 404, message: 'Kunde nicht gefunden.' })
    expect(page.get('[data-testid="error-title"]').text()).toBe('Seite nicht gefunden')
    expect(page.text()).toContain('Die Adresse gibt es nicht')
  })

  it('erklärt bei 403 die fehlende Berechtigung', async () => {
    const page = await mount({ statusCode: 403 })
    expect(page.get('[data-testid="error-title"]').text()).toBe('Keine Berechtigung')
  })

  it('bietet immer einen Weg zurück und zum Start', async () => {
    const page = await mount({ statusCode: 500 })
    expect(page.get('[data-testid="error-back"]').text()).toContain('Zurück')
    expect(page.get('[data-testid="error-home"]').text()).toContain('Zum Start')
  })

  it('zeigt die kuratierte Meldung des Servers', async () => {
    const page = await mount({
      statusCode: 409,
      message: 'Zu diesem Auftrag gibt es bereits eine aktive Rechnung.',
    })
    expect(page.get('[data-testid="error-detail"]').text()).toBe(
      'Zu diesem Auftrag gibt es bereits eine aktive Rechnung.',
    )
  })

  it('B-012: eine englische Framework-Meldung erreicht den Nutzer nicht', async () => {
    // Der Vorgänger reichte "Not Found" ungefiltert bis in die Fehlerseite durch.
    const page = await mount({ statusCode: 404, message: 'Not Found' })
    expect(page.find('[data-testid="error-detail"]').exists()).toBe(false)
    expect(page.text()).not.toContain('Not Found')
  })

  it('zeigt bei einem Serverfehler keine technischen Einzelheiten', async () => {
    const page = await mount({
      statusCode: 500,
      message: 'Ein interner Fehler ist aufgetreten.',
    })
    expect(page.text()).not.toMatch(/at |\.ts:|SELECT/)
  })
})

describe('Der Weg zurück', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('geht im Verlauf zurück, wenn es etwas zurückzugehen gibt', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)

    const page = await mount({ statusCode: 404 })
    await page.get('[data-testid="error-back"]').trigger('click')

    expect(back).toHaveBeenCalledTimes(1)
  })

  it('führt zur Startseite, wenn es keinen Verlauf gibt', async () => {
    // Beim ersten Aufruf eines fehlerhaften Links landete der Nutzer sonst in
    // einer Sackgasse: ein Zurück-Knopf, der nichts tut.
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)

    const page = await mount({ statusCode: 404 })
    await page.get('[data-testid="error-back"]').trigger('click')

    expect(back).not.toHaveBeenCalled()
  })
})
