/**
 * Die Verlaufskurve im echten Browser (M-35).
 *
 * Sie steht hier und nicht bei den übrigen Anzeigekomponenten, weil Chart.js
 * auf ein `<canvas>` zeichnet — und ein Zeichenkontext ist in happy-dom nicht
 * zu haben. Das ist keine Ausnahme, die etwas schwächer prüft, sondern die
 * richtige Ebene: ein Diagramm ist eine Sache des Browsers.
 *
 * Geprüft wird, **was ankommt** — nicht, wie Chart.js zeichnet. Pixel eines
 * Fremdpakets zu prüfen hieße, jedes Update zu einem Testlauf zu machen.
 * Prüfbar und zugleich das, was ein blinder Nutzer bekommt, ist die Tabelle
 * daneben.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import TrendChart from '~/components/ui/TrendChart.vue'
import { formatEuro } from '#shared/money'

const POINTS = [
  { at: '2026-01-31', value: 120_000 },
  { at: '2026-02-28', value: 95_000 },
  { at: '2026-03-31', value: 141_000 },
]

const chart = (props: Record<string, unknown> = {}) =>
  render(TrendChart, {
    props: { points: POINTS, label: 'Umsatz', format: formatEuro, ...props },
  })

/** Das gerenderte Wurzelelement der Komponente. */
const rootOf = () => document.querySelector('[data-testid="trend-chart"]')!

describe('M-35: die Verlaufskurve', () => {
  it('zeichnet etwas, statt nur eine Fläche zu reservieren', async () => {
    await chart()
    const canvas = rootOf().querySelector<HTMLCanvasElement>('[data-testid="trend-plot"] canvas')!

    expect(canvas).not.toBeNull()
    // Chart.js setzt die Zeichenfläche auf die Größe des Behälters. Bleibt
    // sie bei den 300×150 des Browsers, hat nichts gezeichnet.
    expect(canvas.width).toBeGreaterThan(0)
    expect(canvas.height).toBeGreaterThan(0)
  })

  it('nennt den letzten Wert im Klartext', async () => {
    await chart()
    expect(rootOf().querySelector('[data-testid="trend-latest"]')?.textContent?.trim())
      .toBe(formatEuro(141_000))
  })

  it('ist für einen Screenreader beschriftet', async () => {
    await chart()
    const plot = rootOf().querySelector('[data-testid="trend-plot"]')!

    expect(plot.getAttribute('role')).toBe('img')
    const label = plot.getAttribute('aria-label') ?? ''
    expect(label).toContain('Umsatz')
    expect(label).toContain('31.01.2026')
    expect(label).toContain('31.03.2026')
  })

  it('M-35: zeigt den Verlauf als Kurve und dieselben Zahlen als Tabelle', async () => {
    // Ein Diagramm allein ist keine Auskunft: wer es nicht sehen kann, muss
    // die Zahlen trotzdem bekommen. Die Tabelle steht daneben, nicht darin —
    // bei einem Canvas ist sie die einzige Auskunft, die ein Screenreader hat.
    await chart()
    const table = rootOf().querySelector('[data-testid="trend-table"]')!

    expect(table.classList).toContain('sr-only')
    expect(table.textContent).toContain('28.02.2026')
    expect(table.textContent).toContain(formatEuro(95_000))
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3)
  })

  it('schreibt die Werte in der Schreibweise der Anwendung', async () => {
    await chart()
    expect(rootOf().querySelector('[data-testid="trend-table"]')?.textContent)
      .toContain(formatEuro(120_000))
  })

  it('sagt es, wenn es nichts zu zeigen gibt', async () => {
    await chart({ points: [] })
    const root = rootOf()

    expect(root.querySelector('[data-testid="trend-empty"]')?.textContent)
      .toContain('Für diesen Zeitraum gibt es nichts zu zeigen.')
    expect(root.querySelector('[data-testid="trend-plot"]')).toBeNull()
    expect(root.querySelector('[data-testid="trend-table"]')).toBeNull()
  })

  it('kommt auch mit einem einzigen Punkt zurecht', async () => {
    await chart({ points: [{ at: '2026-01-31', value: 500 }] })
    const root = rootOf()

    expect(root.querySelector('[data-testid="trend-plot"]')).not.toBeNull()
    expect(root.querySelector('[data-testid="trend-latest"]')?.textContent?.trim())
      .toBe(formatEuro(500))
  })

  it('zeichnet auch eine Reihe aus lauter Nullen', async () => {
    // Ein Monat ohne Umsatz ist kein Fehler. Die Achse hat dann keine
    // Spannweite — gezeichnet werden muss trotzdem etwas, und nirgends darf
    // ein „NaN" stehen.
    await chart({
      points: [
        { at: '2026-01-31', value: 0 },
        { at: '2026-02-28', value: 0 },
      ],
    })
    const root = rootOf()

    expect(root.querySelector('[data-testid="trend-plot"] canvas')).not.toBeNull()
    expect(root.textContent).not.toContain('NaN')
  })

  it('kommt mit negativen Werten zurecht', async () => {
    // Ein Kassenbestand kann ins Minus gehen.
    await chart({
      points: [
        { at: '2026-01-31', value: -5000 },
        { at: '2026-02-28', value: 8000 },
      ],
    })
    expect(rootOf().querySelector('[data-testid="trend-table"]')?.textContent)
      .toContain(formatEuro(-5000))
  })

  it('kommt ohne eigene Schreibweise aus', async () => {
    await render(TrendChart, { props: { points: POINTS, label: 'Stück' } })
    expect(rootOf().querySelector('[data-testid="trend-latest"]')?.textContent?.trim())
      .toBe('141000')
  })
})
