/**
 * Der Abgleich gegen echte Datenlecks (E-23).
 *
 * Zwei Zusagen werden hier geprüft, und die erste ist die wichtigere:
 *
 *   1. **Das Passwort verlässt den Server nicht.** Nur fünf Zeichen des
 *      SHA-1 gehen hinaus. Jeder Test hier sieht nach, was tatsächlich in der
 *      Adresse steht.
 *   2. **Scheitert der Abruf, scheitert nicht das Passwort** — aber es wird
 *      auch nicht still durchgewunken.
 *
 * Das Netz wird **nie** angefasst: `fetch` wird hereingereicht.
 */
import { describe, expect, it, vi } from 'vitest'
import { countInRange, sha1Of, timesBreached } from '../../server/utils/password-breach'

/** Ein `fetch`, das eine feste Antwort gibt und die Adresse festhält. */
function stubFetch(body: string, ok = true) {
  const calls: { url: string, init?: RequestInit }[] = []
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return { ok, text: async () => body } as Response
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

const PASSWORD = 'kupplung wechsel dienstag'

describe('sha1Of', () => {
  it('rechnet den bekannten Hash', () => {
    // Der meistgeprüfte SHA-1 der Welt — er belegt, dass hier UTF-8 und
    // Großschreibung stimmen.
    expect(sha1Of('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })

  it('rechnet Umlaute als UTF-8', () => {
    expect(sha1Of('küche')).toHaveLength(40)
    expect(sha1Of('küche')).not.toBe(sha1Of('kuche'))
  })
})

describe('countInRange', () => {
  it('findet den eigenen Rest und liest die Anzahl', () => {
    const body = 'AAAA1:3\r\nBBBB2:17\r\nCCCC3:1\r\n'
    expect(countInRange(body, 'BBBB2')).toBe(17)
  })

  it('meldet 0, wenn der Rest nicht dabei ist', () => {
    expect(countInRange('AAAA1:3\r\n', 'ZZZZ9')).toBe(0)
  })

  it('kommt mit Groß- und Kleinschreibung zurecht', () => {
    expect(countInRange('bbbb2:17\n', 'BBBB2')).toBe(17)
  })

  it('übergeht kaputte Zeilen, statt sie als Treffer zu lesen', () => {
    const body = 'nurmüll\n\nBBBB2:17\nnoch:mehr:müll\n'
    expect(countInRange(body, 'BBBB2')).toBe(17)
  })

  it('liest eine unlesbare Anzahl als 0, nicht als NaN', () => {
    expect(countInRange('BBBB2:viele\n', 'BBBB2')).toBe(0)
  })

  it('meldet bei leerer Antwort 0', () => {
    expect(countInRange('', 'BBBB2')).toBe(0)
  })
})

describe('E-23: nur fünf Zeichen verlassen den Server', () => {
  it('E-23: die Adresse trägt genau das Präfix und sonst nichts', async () => {
    const hash = sha1Of(PASSWORD)
    const { impl, calls } = stubFetch('')

    await timesBreached(PASSWORD, impl)

    expect(calls.length).toBe(1)
    expect(calls[0]!.url).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`)
  })

  it('E-23: weder das Passwort noch der volle Hash gehen hinaus', async () => {
    const hash = sha1Of(PASSWORD)
    const { impl, calls } = stubFetch('')

    await timesBreached(PASSWORD, impl)

    const sent = JSON.stringify(calls[0])
    expect(sent).not.toContain(PASSWORD)
    expect(sent).not.toContain(hash)
    expect(sent).not.toContain(hash.slice(5))
  })

  it('E-23: die Antwort wird um Blindeinträge gebeten', async () => {
    // Ohne das verrät allein die Länge der Antwort etwas über das Präfix.
    const { impl, calls } = stubFetch('')
    await timesBreached(PASSWORD, impl)

    const headers = calls[0]!.init?.headers as Record<string, string>
    expect(headers['Add-Padding']).toBe('true')
  })
})

describe('E-23: was zurückkommt', () => {
  it('E-23: findet das Passwort in der Antwort', async () => {
    const suffix = sha1Of(PASSWORD).slice(5)
    const { impl } = stubFetch(`AAAA1:3\r\n${suffix}:42\r\n`)

    expect(await timesBreached(PASSWORD, impl)).toBe(42)
  })

  it('E-23: nicht gefunden ist 0 und nicht null', async () => {
    // Der Unterschied ist der ganze Punkt: 0 heißt „geprüft und sauber",
    // null heißt „konnte nicht geprüft werden".
    const { impl } = stubFetch('AAAA1:3\r\nBBBB2:17\r\n')
    expect(await timesBreached(PASSWORD, impl)).toBe(0)
  })
})

describe('E-23: scheitert der Abruf, scheitert nicht das Passwort', () => {
  it('E-23: kein Netz ergibt null', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    expect(await timesBreached(PASSWORD, impl)).toBeNull()
  })

  it('E-23: eine Fehlerantwort ergibt null', async () => {
    const { impl } = stubFetch('', false)
    expect(await timesBreached(PASSWORD, impl)).toBeNull()
  })

  it('E-23: eine Zeitüberschreitung ergibt null', async () => {
    // Ein langsamer fremder Dienst darf das Anlegen eines Benutzers nicht
    // aufhalten.
    const impl = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch

    expect(await timesBreached(PASSWORD, impl, 20)).toBeNull()
  })

  it('E-23: ein leeres Passwort wird gar nicht erst gefragt', async () => {
    const { impl, calls } = stubFetch('')
    expect(await timesBreached('', impl)).toBeNull()
    expect(calls.length).toBe(0)
  })

  it('E-23: der Wecker wird auch bei Erfolg abgeräumt', async () => {
    // Sonst hielte ein offener Zeitgeber den Prozess am Leben, und der
    // Testlauf endet nicht mehr von selbst — der Klassiker bei einem
    // `setTimeout` ohne `finally`.
    vi.useFakeTimers()
    try {
      const { impl } = stubFetch('AAAA1:3\r\n')
      await timesBreached(PASSWORD, impl)
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
