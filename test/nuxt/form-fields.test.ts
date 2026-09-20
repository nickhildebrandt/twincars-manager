/**
 * Datum und Geld — die beiden Felder, an denen sich Fehler in Cent und in
 * Tagen messen lassen.
 *
 * Das Datumsfeld rechnet **ohne** `Date`: wer eines dazwischenschaltet,
 * verliert um Mitternacht UTC einen Tag, und genau daraus entstehen
 * Rechnungen mit falschem Leistungsdatum (B-028).
 *
 * Das Geldfeld rechnet in ganzen Cent (E-10) und rundet erst beim Verlassen,
 * damit die Eingabe nicht unter den Fingern springt.
 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UApp } from '#components'
import { de } from '@nuxt/ui/locale'
import DateField from '~/components/form/DateField.vue'
import MoneyField from '~/components/form/MoneyField.vue'

/**
 * Das Datumsfeld nimmt seine Schreibweise aus `UApp` — wie in `app.vue`.
 *
 * Ohne diese Hülle schreibt Nuxt UI amerikanisch: `01/03/2026` heißt dann der
 * 3. Januar und nicht der 1. März. Der Test wird deshalb genauso eingehängt
 * wie die Anwendung selbst, sonst prüft er etwas anderes als das, was läuft.
 */
const inGermanApp = (component: unknown, attributes: string) => defineComponent({
  components: { UApp, Field: component as never },
  setup: () => ({ de }),
  template: `<UApp :locale="de"><Field ${attributes} /></UApp>`,
})

describe('DateField', () => {
  const mount = (props: Record<string, unknown> = {}) =>
    mountSuspended(DateField, { props: { label: 'Rechnungsdatum', name: 'issueDate', ...props } })

  /** Die Segmente des Feldes: Tag, Trenner, Monat, Trenner, Jahr. */
  const segmentsOf = (element: Element) =>
    [...element.querySelectorAll('[data-reka-date-field-segment]')]
      .map(segment => ({
        kind: segment.getAttribute('data-segment'),
        text: segment.textContent ?? '',
      }))

  it('zeigt die Beschriftung und trägt einen Testselektor', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).toContain('Rechnungsdatum')
    expect(wrapper.find('[data-testid="date-issueDate"]').exists()).toBe(true)
  })

  it('kommt mit einem leeren Wert zurecht', async () => {
    const wrapper = await mount({ modelValue: null })
    expect(wrapper.html()).not.toContain('NaN')
  })

  it('schreibt das Datum deutsch: Tag, Monat, Jahr', async () => {
    // `01/03/2026` und `01.03.2026` bezeichnen zwei verschiedene Tage. Die
    // Reihenfolge ist deshalb kein Geschmacksfrage, sondern Richtigkeit.
    const wrapper = await mountSuspended(
      inGermanApp(DateField, 'label="Rechnungsdatum" name="issueDate" model-value="2026-03-01"'),
    )
    const segments = segmentsOf(wrapper.element as Element)

    expect(segments.map(segment => segment.kind))
      .toEqual(['day', 'literal', 'month', 'literal', 'year'])
    expect(segments[1]?.text).toBe('.')
    expect(segments[0]?.text).toBe('1')
    expect(segments[2]?.text).toBe('3')
    expect(segments[4]?.text).toBe('2026')
  })

  it('B-028: gibt genau den Tag zurück, den es bekommen hat', async () => {
    // Der gefährliche Fall: ein Tag am Monatsanfang, in einer Zeitzone östlich
    // von Greenwich. Über ein `Date` würde daraus der Vortag.
    const wrapper = await mount({ modelValue: '2026-01-01' })
    const hidden = wrapper.find('input[type="date"]')
    expect((hidden.element as HTMLInputElement).value).toBe('2026-01-01')
  })

  it('B-028: hält auch den 31. Dezember fest', async () => {
    const wrapper = await mount({ modelValue: '2025-12-31' })
    expect((wrapper.find('input[type="date"]').element as HTMLInputElement).value)
      .toBe('2025-12-31')
  })

  it('markiert ein Pflichtfeld an der Beschriftung', async () => {
    // Nuxt UI setzt den Stern an das Label. Ein `aria-required` bekommt das
    // Feld nicht — es besteht aus drei Segmenten, nicht aus einem Eingabefeld
    // (siehe blocker.md, W-02).
    const wrapper = await mount({ required: true })
    expect(wrapper.get('label').classes().join(' ')).toContain('after:content-[\'*\']')
  })

  it('lässt sich sperren', async () => {
    const wrapper = await mount({ disabled: true })
    expect(wrapper.html()).toContain('disabled')
  })

  it('gibt dem Feld den Namen mit, den das Formular erwartet', async () => {
    const wrapper = await mount({ modelValue: '2026-01-01' })
    expect(wrapper.find('input[type="date"]').attributes('name')).toBe('issueDate')
  })

  // Der Weg zurück — Tippen im Feld ergibt eine Zeichenkette `YYYY-MM-DD` —
  // steht in `test/browser/date-field.test.ts`: das Feld besteht aus drei
  // Segmenten, die auf Tastendrücke reagieren, und dafür braucht es einen
  // echten Browser.

  it('fällt ohne Namen auf einen allgemeinen Selektor zurück', async () => {
    const wrapper = await mountSuspended(DateField, { props: {} })
    expect(wrapper.find('[data-testid="date-field"]').exists()).toBe(true)
  })
})

describe('MoneyField', () => {
  const mount = (props: Record<string, unknown> = {}) =>
    mountSuspended(MoneyField, { props: { label: 'Betrag', name: 'amount', ...props } })

  const input = (wrapper: Awaited<ReturnType<typeof mount>>) =>
    wrapper.get('[data-testid="money-amount"]')

  it('zeigt ganze Cent als deutschen Betrag', async () => {
    const wrapper = await mount({ modelValue: 123_456 })
    expect((input(wrapper).element as HTMLInputElement).value).toBe('1.234,56')
  })

  it('liest einen deutschen Betrag als ganze Cent', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('1.234,56')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([123_456])
  })

  it('liest auch die Schreibweise mit Punkt', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('1234.56')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([123_456])
  })

  it('schreibt den gelesenen Betrag ordentlich zurück', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('1234,5')
    await input(wrapper).trigger('blur')

    expect((input(wrapper).element as HTMLInputElement).value).toBe('1.234,50')
  })

  it('rechnet erst beim Verlassen, nicht beim Tippen', async () => {
    // Sonst springt die Eingabe unter den Fingern: aus „12" würde „12,00",
    // und die nächste Ziffer landete hinter dem Komma.
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('12')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input(wrapper).trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1200])
  })

  it('rechnet auch auf die Eingabetaste', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('99,99')
    await input(wrapper).trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([9999])
  })

  it('macht aus einem leeren Feld nichts statt einer Null', async () => {
    // Kein Betrag und ein Betrag von null sind zwei verschiedene Aussagen.
    const wrapper = await mount({ modelValue: 5000 })
    await input(wrapper).setValue('')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('lässt Unlesbares stehen und meldet es, statt still eine Null zu setzen', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('zwölf Euro')
    await input(wrapper).trigger('blur')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.text()).toContain('Bitte einen Betrag wie 1.234,56 eingeben.')
    expect((input(wrapper).element as HTMLInputElement).value).toBe('zwölf Euro')
  })

  it('nimmt die Meldung zurück, sobald die Eingabe stimmt', async () => {
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('zwölf Euro')
    await input(wrapper).trigger('blur')
    expect(wrapper.text()).toContain('Bitte einen Betrag')

    await input(wrapper).setValue('12,00')
    await input(wrapper).trigger('blur')
    expect(wrapper.text()).not.toContain('Bitte einen Betrag')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1200])
  })

  it('übernimmt einen von außen gesetzten Betrag', async () => {
    const wrapper = await mount({ modelValue: 1000 })
    await wrapper.setProps({ modelValue: 250_000 })
    await nextTick()

    expect((input(wrapper).element as HTMLInputElement).value).toBe('2.500,00')
  })

  it('überschreibt eine fehlerhafte Eingabe nicht von außen', async () => {
    // Sonst verschwindet, was jemand gerade getippt hat, während er noch
    // überlegt, was daran falsch war.
    const wrapper = await mount({ modelValue: null })
    await input(wrapper).setValue('zwölf Euro')
    await input(wrapper).trigger('blur')

    await wrapper.setProps({ modelValue: 999 })
    await nextTick()
    expect((input(wrapper).element as HTMLInputElement).value).toBe('zwölf Euro')
  })

  it('zeigt das Euro-Zeichen am Feld, nicht im Wert', async () => {
    const wrapper = await mount({ modelValue: 1000 })
    expect(wrapper.text()).toContain('€')
    expect((input(wrapper).element as HTMLInputElement).value).toBe('10,00')
  })

  it('bietet auf dem Telefon die Zifferntastatur an', async () => {
    const wrapper = await mount()
    expect(input(wrapper).attributes('inputmode')).toBe('decimal')
  })

  it('fällt ohne Namen auf einen allgemeinen Selektor zurück', async () => {
    const wrapper = await mountSuspended(MoneyField, { props: {} })
    expect(wrapper.find('[data-testid="money-field"]').exists()).toBe(true)
  })
})
