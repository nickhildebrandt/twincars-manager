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
import StatTile from '~/components/ui/StatTile.vue'
import FileDropzone from '~/components/ui/FileDropzone.vue'
import type { TimelineEntry } from '~/components/ui/Timeline.vue'

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
    { id: 'e-3', date: '2025-06-30', title: 'HU bestanden' },
  ]

  /* Geprüft wird, **was der Nutzer sieht** — nicht, aus welchen Kästen Nuxt UI
     das baut. Bis zum 20.09.2026 hingen diese Tests an einem eigenen Nachbau
     mit `data-testid` je Eintrag; mit `UTimeline` gibt es den nicht mehr, und
     das ist richtig so: an interne Markup-Details eines Fremdpakets zu
     prüfen, macht jedes Update zu einem Testlauf. */

  it('zeigt jeden Eintrag', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    const text = wrapper.text()
    for (const entry of ENTRIES) expect(text).toContain(entry.title)
  })

  it('sortiert neueste zuerst', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    const text = wrapper.text()
    expect(text.indexOf('Kennzeichen geändert')).toBeLessThan(text.indexOf('HU bestanden'))
    expect(text.indexOf('HU bestanden')).toBeLessThan(text.indexOf('Halterwechsel'))
  })

  it('dreht die Richtung für einen Preisverlauf', async () => {
    const wrapper = await mountSuspended(Timeline, {
      props: { entries: ENTRIES, newestFirst: false },
    })
    const text = wrapper.text()
    expect(text.indexOf('Halterwechsel')).toBeLessThan(text.indexOf('HU bestanden'))
    expect(text.indexOf('HU bestanden')).toBeLessThan(text.indexOf('Kennzeichen geändert'))
  })

  it('schreibt das Datum deutsch', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    expect(wrapper.text()).toContain('01.03.2024')
    expect(wrapper.text()).not.toContain('2024-03-01')
  })

  it('zeigt Einzelheiten und Urheber, wenn es sie gibt', async () => {
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    expect(wrapper.text()).toContain('Meier GmbH → Anna Schuster')
    expect(wrapper.text()).toContain('Anna Chefin')
  })

  it('M-02: zeigt die Historie als Zeitstrahl, nicht als Tabelle', async () => {
    // Eine Tabelle beantwortet „was stand wann drin". Ein Zeitstrahl
    // beantwortet „was ist passiert" — und das ist die Frage, die jemand
    // stellt, der eine Historie öffnet.
    const wrapper = await mountSuspended(Timeline, { props: { entries: ENTRIES } })
    expect(wrapper.find('[data-testid="timeline-list"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
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

/* Die Verlaufskurve steht **nicht** hier, sondern in
   `test/browser/trend-chart.test.ts`.

   Seit dem 20.09.2026 zeichnet `nuxt-charts` sie, und dessen Unterbau Unovis
   fasst das DOM unmittelbar an: er hängt einen `MutationObserver` an den
   Tooltip und lässt einen gedrosselten Zeitgeber laufen. In happy-dom bricht
   beides — beim Stehenlassen („document is not defined" nach dem Testende)
   wie beim Abbauen („Cannot read private member #listeners"). Siehe W-04 in
   ../../docs/rewrite/blocker.md.

   Das ist kein Grund für eine Krücke: ein Diagramm ist eine Sache des
   Browsers, und für Sachen des Browsers gibt es das Browser-Projekt. */

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

  /* Geprüft wird über das echte `<input type="file">`, das `UFileUpload`
     rendert — der Weg, den auch ein Mensch nimmt. Bis zum 20.09.2026 stand
     hier ein eigener Nachbau, und die Tests warfen `drop`-Ereignisse auf
     seine Wurzel, prüften die Randfarbe beim Darüberziehen und ob ein
     versteckter Knopf `input.click()` aufruft. Das war Prüfung der eigenen
     Gestaltung, nicht der Fachregel. Ablegen, Hervorheben und Tastatur
     gehören jetzt Nuxt UI; geprüft wird hier nur noch, **was durchgelassen
     wird und was nicht**. */
  const chooseFiles = async (
    wrapper: Awaited<ReturnType<typeof mountSuspended>>,
    files: File[],
  ) => {
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
    await nextTick()
  }

  it('steht auf Nuxt UI, nicht auf einem Nachbau', async () => {
    // Der Test, der einen Rückfall bemerkt: kein eigenes `@dragover`, kein
    // eigener versteckter Knopf — ein `UFileUpload` mit seiner Ablagefläche.
    const wrapper = await mountSuspended(FileDropzone)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dropzone-browse"]').exists()).toBe(false)
  })

  it('nimmt eine erlaubte Datei an', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await chooseFiles(wrapper, [fileOf('rechnung.pdf', 'application/pdf', 1000)])

    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('B-115: weist dieselben Formate ab wie der Dialog', async () => {
    // Beim Vorgänger prüfte das Ablegen nur auf „irgendein Bild" und ließ
    // Formate durch, die der Dialog gar nicht anbot.
    const wrapper = await mountSuspended(FileDropzone)
    await chooseFiles(wrapper, [fileOf('bild.tiff', 'image/tiff', 1000)])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(notifyError).toHaveBeenCalledOnce()
  })

  it('hält sich an eine engere Vorgabe', async () => {
    const wrapper = await mountSuspended(FileDropzone, {
      props: { accept: ['image/jpeg', 'image/png'] },
    })
    await chooseFiles(wrapper, [fileOf('rechnung.pdf', 'application/pdf', 1000)])

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
    await chooseFiles(wrapper, [fileOf('gerade-noch.pdf', 'application/pdf', LIMITS.document.bytes)])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)

    const zuGross = await mountSuspended(FileDropzone)
    await chooseFiles(zuGross, [fileOf('zu-viel.pdf', 'application/pdf', LIMITS.document.bytes + 1)])
    expect(zuGross.emitted('files')).toBeUndefined()
  })

  it('B-100: sagt es, wenn eine Datei zu groß ist', async () => {
    // Beim Vorgänger verschwand der Fehler in einem leeren `catch`.
    const wrapper = await mountSuspended(FileDropzone)
    await chooseFiles(wrapper, [fileOf('riesig.pdf', 'application/pdf', 99 * 1024 * 1024)])

    expect(wrapper.emitted('files')).toBeUndefined()
    expect(notifyError).toHaveBeenCalledWith(
      '„riesig.pdf" ist zu groß.',
      expect.objectContaining({ description: expect.stringContaining('MB') }),
    )
  })

  it('nimmt nur eine Datei, wenn nur eine vorgesehen ist', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await chooseFiles(wrapper, [
      fileOf('eins.pdf', 'application/pdf', 100),
      fileOf('zwei.pdf', 'application/pdf', 100),
    ])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
  })

  it('nimmt mehrere, wenn mehrere vorgesehen sind', async () => {
    const wrapper = await mountSuspended(FileDropzone, { props: { multiple: true } })
    await chooseFiles(wrapper, [
      fileOf('eins.pdf', 'application/pdf', 100),
      fileOf('zwei.pdf', 'application/pdf', 100),
    ])
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(2)
  })

  it('kommt mit einer Auswahl ohne Dateien zurecht', async () => {
    const wrapper = await mountSuspended(FileDropzone)
    await chooseFiles(wrapper, [])
    expect(wrapper.emitted('files')).toBeUndefined()
  })

  it('nimmt eine eigene Beschriftung an', async () => {
    const wrapper = await mountSuspended(FileDropzone, {
      props: { label: 'Fahrzeugschein hierher ziehen' },
    })
    expect(wrapper.text()).toContain('Fahrzeugschein hierher ziehen')
  })

  it('meldet jede abgewiesene Datei einzeln', async () => {
    const wrapper = await mountSuspended(FileDropzone, { props: { multiple: true } })
    await chooseFiles(wrapper, [
      fileOf('a.tiff', 'image/tiff', 100),
      fileOf('b.exe', 'application/x-msdownload', 100),
      fileOf('c.pdf', 'application/pdf', 100),
    ])

    expect(notifyError).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('files')?.at(-1)?.[0]).toHaveLength(1)
  })
})
