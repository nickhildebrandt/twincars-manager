/**
 * Die darstellenden Bausteine: Zeitstrahl (M-02), Verlaufskurve (M-35),
 * Kennzahl und Dateiablage.
 *
 * Alle vier rechnen nichts aus und laden nichts nach. Geprüft wird deshalb,
 * was sie aus dem machen, was sie bekommen — und dass eine Grafik nie die
 * einzige Auskunft ist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import Timeline from '~/components/ui/Timeline.vue'
import TrendChart from '~/components/ui/TrendChart.vue'
import StatTile from '~/components/ui/StatTile.vue'
import FileDropzone from '~/components/ui/FileDropzone.vue'
import type { TimelineEntry } from '~/components/ui/Timeline.vue'
import { formatEuro } from '#shared/money'

const { notifyError } = vi.hoisted(() => ({ notifyError: vi.fn() }))

mockNuxtImport('useNotify', () => () => ({
  success: vi.fn(),
  error: notifyError,
  warning: vi.fn(),
  info: vi.fn(),
}))

beforeEach(() => {
  notifyError.mockClear()
})

describe('M-02: die Historie als Zeitstrahl', () => {
  const ENTRIES: TimelineEntry[] = [
    { id: 'e-1', date: '2024-03-01', title: 'Halterwechsel', description: 'Meier GmbH → Anna Schuster' },
    { id: 'e-2', date: '2026-01-15', title: 'Kennzeichen geändert', actor: 'Anna Chefin' },
    { id: 'e-3', date: '2025-06-30', title: 'HU bestanden', tone: 'success' },
  ]

  it('zeigt jeden Eintrag', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    for (const entry of ENTRIES) {
      expect(wrapper.find(`[data-testid="timeline-entry-${entry.id}"]`).exists()).toBe(true)
    }
  })

  it('sortiert neueste zuerst', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    const ids = wrapper.findAll('li').map(entry => entry.attributes('data-testid'))
    expect(ids).toEqual([
      'timeline-entry-e-2',
      'timeline-entry-e-3',
      'timeline-entry-e-1',
    ])
  })

  it('dreht die Richtung für einen Preisverlauf', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { entries: ENTRIES, newestFirst: false },
    })
    const ids = wrapper.findAll('li').map(entry => entry.attributes('data-testid'))
    expect(ids[0]).toBe('timeline-entry-e-1')
  })

  it('schreibt das Datum deutsch und maschinenlesbar zugleich', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    const time = wrapper.get('[data-testid="timeline-entry-e-1"] time')
    expect(time.attributes('datetime')).toBe('2024-03-01')
    expect(time.text()).toBe('01.03.2024')
  })

  it('zeigt Einzelheiten und Urheber, wenn es sie gibt', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    expect(wrapper.get('[data-testid="timeline-entry-e-1"]').text())
      .toContain('Meier GmbH → Anna Schuster')
    expect(wrapper.get('[data-testid="timeline-entry-e-2"]').text()).toContain('Anna Chefin')
  })

  it('M-02: zeigt die Historie als Zeitstrahl, nicht als Tabelle', async () => {
    // Eine Tabelle beantwortet „was stand wann drin". Ein Zeitstrahl
    // beantwortet „was ist passiert" — und das ist die Frage, die jemand
    // stellt, der eine Historie öffnet. Er ist eine **geordnete** Liste,
    // damit ein Screenreader die Reihenfolge hört.
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    expect(wrapper.find('ol').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('li')).toHaveLength(ENTRIES.length)
  })

  it('sagt es, wenn nichts passiert ist', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: [] } })
    expect(wrapper.get('[data-testid="timeline-empty"]').text()).toBe('Bisher ist nichts passiert.')
  })

  it('nimmt einen eigenen Leertext an', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { entries: [], emptyText: 'Für dieses Fahrzeug gibt es noch keine Historie.' },
    })
    expect(wrapper.get('[data-testid="timeline-empty"]').text())
      .toBe('Für dieses Fahrzeug gibt es noch keine Historie.')
  })
})

describe('M-35: die Verlaufskurve', () => {
  const POINTS = [
    { at: '2026-01-31', value: 120_000 },
    { at: '2026-02-28', value: 95_000 },
    { at: '2026-03-31', value: 141_000 },
  ]

  const chart = (props: Record<string, unknown> = {}) =>
    mountSuspended(TrendChart, {
      props: { points: POINTS, label: 'Umsatz', format: formatEuro, ...props },
    })

  it('zeichnet eine Linie durch alle Punkte', async () => {
    const wrapper = await chart()
    const path = wrapper.get('path[stroke="currentColor"]').attributes('d') ?? ''
    // Ein „M" und zwei „L": drei Punkte.
    expect(path.match(/L /g)).toHaveLength(2)
    expect(path.startsWith('M ')).toBe(true)
  })

  it('nennt den letzten Wert im Klartext', async () => {
    const wrapper = await chart()
    expect(wrapper.get('[data-testid="trend-latest"]').text()).toBe(formatEuro(141_000))
  })

  it('ist für einen Screenreader beschriftet', async () => {
    const wrapper = await chart()
    const label = wrapper.get('svg').attributes('aria-label') ?? ''
    expect(label).toContain('Umsatz')
    expect(label).toContain('31.01.2026')
    expect(label).toContain('31.03.2026')
  })

  it('M-35: zeigt den Verlauf als Kurve und dieselben Zahlen als Tabelle', async () => {
    // Ein Diagramm allein ist keine Auskunft: wer es nicht sehen kann, muss
    // die Zahlen trotzdem bekommen.
    const wrapper = await chart()
    const table = wrapper.get('table')
    expect(table.classes()).toContain('sr-only')
    expect(table.text()).toContain('28.02.2026')
    expect(table.text()).toContain(formatEuro(95_000))
    expect(table.findAll('tbody tr')).toHaveLength(3)
  })

  it('beschriftet die Achse mit runden Werten', async () => {
    const wrapper = await chart()
    const ticks = wrapper.findAll('text').map(entry => entry.text())
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks).toContain(formatEuro(0))
  })

  it('sagt es, wenn es nichts zu zeigen gibt', async () => {
    const wrapper = await chart({ points: [] })
    expect(wrapper.get('[data-testid="trend-empty"]').text())
      .toBe('Für diesen Zeitraum gibt es nichts zu zeigen.')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('kommt auch mit einem einzigen Punkt zurecht', async () => {
    const wrapper = await chart({ points: [{ at: '2026-01-31', value: 500 }] })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.get('[data-testid="trend-latest"]').text()).toBe(formatEuro(500))
  })

  it('zeichnet auch eine Reihe aus lauter Nullen', async () => {
    // Ein Monat ohne Umsatz ist kein Fehler. Die Achse hat dann keine
    // Spannweite — die Linie muss trotzdem irgendwo liegen.
    const wrapper = await chart({
      points: [
        { at: '2026-01-31', value: 0 },
        { at: '2026-02-28', value: 0 },
      ],
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    const path = wrapper.get('path[stroke="currentColor"]').attributes('d') ?? ''
    expect(path).not.toContain('NaN')
  })

  it('kommt ohne eigene Schreibweise aus', async () => {
    const wrapper = await mountSuspended(TrendChart, {
      props: { points: POINTS, label: 'Stück' },
    })
    expect(wrapper.get('[data-testid="trend-latest"]').text()).toBe('141000')
  })

  it('zeigt negative Werte mit sichtbarer Nulllinie', async () => {
    const wrapper = await chart({
      points: [
        { at: '2026-01-31', value: -5000 },
        { at: '2026-02-28', value: 8000 },
      ],
    })
    const ticks = wrapper.findAll('text').map(entry => entry.text())
    expect(ticks).toContain(formatEuro(0))
  })
})

describe('Die Kennzahl', () => {
  it('zeigt Bezeichnung und Wert', async () => {
    const wrapper = await mountSuspended(StatTile, {
      props: { label: 'Offene Rechnungen', value: '4.210,00 €' },
    })
    expect(wrapper.text()).toContain('Offene Rechnungen')
    expect(wrapper.get('[data-testid="stat-value"]').text()).toBe('4.210,00 €')
  })

  it('zeigt einen Anstieg mit Vorzeichen', async () => {
    const wrapper = await mountSuspended(StatTile, {
      props: { label: 'Umsatz', value: '1.000,00 €', change: 12 },
    })
    const change = wrapper.get('[data-testid="stat-change"]')
    expect(change.text()).toContain('+12 %')
    expect(change.classes()).toContain('text-success')
  })

  it('zeigt einen Rückgang ohne erfundenes Vorzeichen', async () => {
    const wrapper = await mountSuspended(StatTile, {
      props: { label: 'Umsatz', value: '800,00 €', change: -7 },
    })
    const change = wrapper.get('[data-testid="stat-change"]')
    expect(change.text()).toContain('-7 %')
    expect(change.classes()).toContain('text-error')
  })

  it('zeigt keinen Vergleich, wenn sich nichts geändert hat', async () => {
    // „±0 %" in grün oder rot wäre eine Aussage, die niemand getroffen hat.
    const wrapper = await mountSuspended(StatTile, {
      props: { label: 'Umsatz', value: '1.000,00 €', change: 0 },
    })
    expect(wrapper.find('[data-testid="stat-change"]').exists()).toBe(false)
  })

  it('zeigt gar keinen Vergleich, wenn es keinen gibt', async () => {
    const wrapper = await mountSuspended(StatTile, {
      props: { label: 'Umsatz', value: '1.000,00 €' },
    })
    expect(wrapper.find('[data-testid="stat-change"]').exists()).toBe(false)
  })

  it('zeigt Symbol und Fußnote, wenn beides angegeben ist', async () => {
    const wrapper = await mountSuspended(StatTile, {
      props: {
        label: 'Offene Rechnungen',
        value: '4.210,00 €',
        icon: 'i-lucide-receipt',
        hint: 'Stand heute, 12 Belege',
      },
    })
    expect(wrapper.text()).toContain('Stand heute, 12 Belege')
    expect(wrapper.html()).toContain('i-lucide:receipt')
  })
})

describe('Die Dateiablage', () => {
  /** Eine Datei mit Namen, Typ und Größe, wie sie der Browser liefert. */
  const fileOf = (name: string, type: string, bytes: number): File => {
    const file = new File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: bytes })
    return file
  }

  const dropOn = async (
    wrapper: Awaited<ReturnType<typeof mountSuspended>>,
    files: File[],
  ) => {
    const event = new Event('drop', { bubbles: true }) as DragEvent
    Object.defineProperty(event, 'dataTransfer', { value: { files } })
    wrapper.get('[data-testid="dropzone"]').element.dispatchEvent(event)
    await nextTick()
  }

  it('nimmt eine erlaubte Datei an', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await dropOn(wrapper, [fileOf('rechnung.pdf', 'application/pdf', 1000)])

    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('B-115: weist beim Ablegen dieselben Formate ab wie der Dialog', async () => {
    // Dort prüfte das Ablegen nur auf „irgendein Bild" und ließ Formate durch,
    // die der Dialog gar nicht anbot.
    const wrapper = await mountSuspended(FileDropzone)
    await dropOn(wrapper, [fileOf('bild.tiff', 'image/tiff', 1000)])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(notifyError).toHaveBeenCalledOnce()
  })

  it('hält sich an eine engere Vorgabe', async () => {
    const wrapper = await mountSuspended(FileDropzone, {
      props: { accept: ['image/jpeg', 'image/png'] },
    })
    await dropOn(wrapper, [fileOf('rechnung.pdf', 'application/pdf', 1000)])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(notifyError).toHaveBeenCalledOnce()
  })

  it('B-589: kennt genau eine Grenze je Art, nicht sieben im Code verstreut', async () => {
    // Beim Vorgänger galten 7 MB fürs Logo, 8 MiB fürs Reifenfoto, 15 MiB
    // fürs Dokument, 28 MB fürs Fahrzeugfoto — festgelegt an sieben Stellen.
    // Wer eine ändern wollte, fand die anderen nicht.
    const { LIMITS } = await import('#shared/schemas/upload')
    expect(Object.keys(LIMITS).sort())
      .toEqual(['document', 'image', 'legacyDatabase', 'logo', 'mailAttachment'])

    // Die Ablage nimmt ihre Grenze von dort — nicht aus einer eigenen Zahl.
    const wrapper = await mountSuspended(FileDropzone)
    await dropOn(wrapper, [fileOf('gerade-noch.pdf', 'application/pdf', LIMITS.document.bytes)])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)

    const zuGross = await mountSuspended(FileDropzone)
    await dropOn(zuGross, [fileOf('zu-viel.pdf', 'application/pdf', LIMITS.document.bytes + 1)])
    expect(zuGross.emitted('files')).toBeUndefined()
  })

  it('B-100: sagt es, wenn eine Datei zu groß ist', async () => {
    // Beim Vorgänger verschwand der Fehler in einem leeren `catch`.
    const wrapper = await mountSuspended(FileDropzone)
    await dropOn(wrapper, [fileOf('riesig.pdf', 'application/pdf', 99 * 1024 * 1024)])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(notifyError).toHaveBeenCalledWith(
      '„riesig.pdf" ist zu groß.',
      expect.objectContaining({ description: expect.stringContaining('MB') }),
    )
  })

  it('nimmt nur eine Datei, wenn nur eine vorgesehen ist', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await dropOn(wrapper, [
      fileOf('eins.pdf', 'application/pdf', 100),
      fileOf('zwei.pdf', 'application/pdf', 100),
    ])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
  })

  it('nimmt mehrere, wenn mehrere vorgesehen sind', async () => {
    const wrapper = await mountSuspended(FileDropzone, { props: { multiple: true } })
    await dropOn(wrapper, [
      fileOf('eins.pdf', 'application/pdf', 100),
      fileOf('zwei.pdf', 'application/pdf', 100),
    ])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(2)
  })

  it('nimmt gesperrt gar nichts an', async () => {
    const wrapper = await mountSuspended(FileDropzone, { props: { disabled: true } })
    await dropOn(wrapper, [fileOf('eins.pdf', 'application/pdf', 100)])
    expect(wrapper.emitted('files')).toBeUndefined()
  })

  it('nimmt eine Datei auch aus dem Auswahldialog an', async () => {
    // Derselbe Weg, dieselbe Prüfung — beim Vorgänger waren es zwei.
    const wrapper = await mountSuspended(FileDropzone)
    const input = wrapper.get('[data-testid="dropzone-input"]')
    Object.defineProperty(input.element, 'files', {
      value: [fileOf('rechnung.pdf', 'application/pdf', 1000)],
    })
    await input.trigger('change')

    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
  })

  it('zeigt an, wenn etwas über der Fläche schwebt', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    const zone = wrapper.get('[data-testid="dropzone"]')

    await zone.trigger('dragover')
    expect(zone.classes()).toContain('border-primary')

    await zone.trigger('dragleave')
    expect(zone.classes()).not.toContain('border-primary')
  })

  it('kommt mit einem Ablegen ohne Dateien zurecht', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await wrapper.get('[data-testid="dropzone"]').trigger('drop')
    expect(wrapper.emitted('files')).toBeUndefined()
  })

  it('öffnet den Auswahldialog über die Schaltfläche', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    const input = wrapper.get('[data-testid="dropzone-input"]').element as HTMLInputElement
    let opened = 0
    input.click = () => {
      opened += 1
    }

    await wrapper.get('[data-testid="dropzone-browse"]').trigger('click')
    expect(opened).toBe(1)
  })

  it('nimmt eine eigene Beschriftung an', async () => {
    const wrapper = await mountSuspended(FileDropzone, {
      props: { label: 'Fahrzeugschein hierher ziehen' },
    })
    expect(wrapper.text()).toContain('Fahrzeugschein hierher ziehen')
  })

  it('meldet jede abgewiesene Datei einzeln', async () => {
    const wrapper = await mountSuspended(FileDropzone, { props: { multiple: true } })
    await dropOn(wrapper, [
      fileOf('a.tiff', 'image/tiff', 100),
      fileOf('b.exe', 'application/x-msdownload', 100),
      fileOf('c.pdf', 'application/pdf', 100),
    ])

    expect(notifyError).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
  })
})
