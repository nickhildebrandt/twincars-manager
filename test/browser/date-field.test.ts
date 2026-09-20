/**
 * Das Datumsfeld unter den Fingern.
 *
 * Es besteht aus drei Segmenten, die auf Tastendrücke reagieren — das lässt
 * sich nur in einem echten Browser prüfen. Hier geht es um den Weg zurück:
 * was jemand tippt, muss als `YYYY-MM-DD` herauskommen, ohne dass unterwegs
 * ein Tag verloren geht (B-028).
 */
import { describe, expect, it } from 'vitest'
import { render } from '@nuxt/test-utils/browser'
import { userEvent } from 'vitest/browser'
import DateField from '~/components/form/DateField.vue'

/** Das zuletzt nach außen gemeldete Datum. */
let reported: string | null | undefined

const Host = defineComponent({
  props: { start: { type: String, default: null } },
  setup(props) {
    const value = ref<string | null>(props.start)
    watch(value, (next) => {
      reported = next
    })
    return () => h(DateField, {
      'label': 'Rechnungsdatum',
      'name': 'issueDate',
      'modelValue': value.value,
      'onUpdate:modelValue': (next: string | null) => {
        value.value = next
      },
    })
  },
})

async function mountField(start: string | null = null) {
  reported = undefined
  await render(Host, { props: { start } })
  await new Promise(resolve => setTimeout(resolve, 200))
}

const segment = (kind: 'day' | 'month' | 'year'): HTMLElement => {
  const found = document.body.querySelector(`[data-segment="${kind}"]`)
  if (!found) throw new Error(`Kein Segment „${kind}".`)
  return found as HTMLElement
}

describe('Das Datumsfeld', () => {
  it('B-028: gibt genau den getippten Tag heraus', async () => {
    await mountField('2026-03-05')

    segment('day').focus()
    await userEvent.keyboard('15')
    await new Promise(resolve => setTimeout(resolve, 150))

    // Der 15. März — nicht der 14., wie es über ein `Date` in einer Zeitzone
    // östlich von Greenwich herauskäme.
    expect(reported).toBe('2026-03-15')
  })

  it('B-028: hält auch den 1. Januar, der über eine Zeitzone kippen würde', async () => {
    await mountField('2026-03-01')

    segment('month').focus()
    await userEvent.keyboard('01')
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(reported).toBe('2026-01-01')
  })

  it('meldet ein geleertes Feld als leer, nicht als Datum', async () => {
    // Kein Datum und der 1. Januar sind zwei verschiedene Aussagen.
    await mountField('2026-03-01')

    segment('day').focus()
    await userEvent.keyboard('{Backspace}{Backspace}')
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(reported).toBeNull()
  })

  it('zeigt ein von außen gesetztes Datum in den Segmenten', async () => {
    await mountField('2025-12-31')
    expect(segment('day').textContent).toBe('31')
    expect(segment('month').textContent).toBe('12')
    expect(segment('year').textContent).toBe('2025')
  })

  it('lässt sich mit den Pfeiltasten bedienen', async () => {
    await mountField('2026-03-01')

    segment('day').focus()
    await userEvent.keyboard('{ArrowUp}')
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(reported).toBe('2026-03-02')
  })
})
