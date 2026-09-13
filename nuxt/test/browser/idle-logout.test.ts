/**
 * Die Abmeldung bei Untätigkeit, im echten Browser.
 *
 * Zwei Dinge lassen sich nur hier prüfen: dass mehrere Tabs sich denselben
 * Zeitstempel teilen, und dass eine Abmeldung die anderen Tabs erreicht. Genau
 * daran scheiterte der Vorgänger — er zählte je Tab, sodass ein im Hintergrund
 * offener Tab den Nutzer abmeldete, während er woanders arbeitete (B-013,
 * B-072).
 *
 * Die Zeitrechnung selbst liegt in `shared/idle.ts` und ist dort als reine
 * Funktion geprüft; hier geht es um den Browser drumherum.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  IDLE_CHANNEL,
  IDLE_STORAGE_KEY,
  IDLE_WARNING_SECONDS,
  idleStateAt,
} from '#shared/idle'

const MINUTE = 60_000

afterEach(() => {
  localStorage.removeItem(IDLE_STORAGE_KEY)
})

/** Wie ein Tab seine Aktivität hinterlegt. */
const noteActivity = (at: number) => localStorage.setItem(IDLE_STORAGE_KEY, String(at))

/** Wie ein Tab die jüngste Aktivität aller Tabs liest. */
function readLastActivity(fallback: number): number {
  const stored = Number(localStorage.getItem(IDLE_STORAGE_KEY))
  return Number.isFinite(stored) && stored > 0 ? stored : fallback
}

describe('Aktivität über Tabs hinweg', () => {
  it('teilt den Zeitstempel über den lokalen Speicher', () => {
    const at = Date.now()
    noteActivity(at)
    expect(readLastActivity(0)).toBe(at)
  })

  it('hält einen untätigen Tab angemeldet, solange anderswo gearbeitet wird', () => {
    // Tab A ruht seit einer Stunde. Tab B hat vor einer Minute etwas getan und
    // das hinterlegt. Tab A darf nicht abmelden.
    const now = Date.now()
    noteActivity(now - 1 * MINUTE)

    expect(idleStateAt(readLastActivity(now - 60 * MINUTE), now, 60).phase).toBe('active')
  })

  it('meldet ab, wenn in keinem Tab etwas geschieht', () => {
    const now = Date.now()
    noteActivity(now - 61 * MINUTE)
    expect(idleStateAt(readLastActivity(now), now, 60).phase).toBe('expired')
  })

  it('warnt kurz vorher', () => {
    const now = Date.now()
    noteActivity(now - 59 * MINUTE)
    const state = idleStateAt(readLastActivity(now), now, 60)
    expect(state.phase).toBe('warning')
    expect(state.remainingSeconds).toBeLessThanOrEqual(IDLE_WARNING_SECONDS)
  })

  it('kommt mit einem beschädigten Wert zurecht', () => {
    // Ein von Hand veränderter oder von einer alten Fassung geschriebener
    // Wert darf niemanden abmelden.
    const now = Date.now()
    localStorage.setItem(IDLE_STORAGE_KEY, 'kaputt')
    expect(idleStateAt(readLastActivity(now), now, 60).phase).toBe('active')
  })
})

describe('Die Abmeldung erreicht die anderen Tabs', () => {
  it('verteilt die Nachricht über den Kanal', async () => {
    const sender = new BroadcastChannel(IDLE_CHANNEL)
    const receiver = new BroadcastChannel(IDLE_CHANNEL)

    const received = new Promise<string>((resolve) => {
      receiver.addEventListener('message', event => resolve(event.data as string))
    })

    sender.postMessage('signed-out')
    await expect(received).resolves.toBe('signed-out')

    sender.close()
    receiver.close()
  })

  it('erreicht jeden offenen Tab, nicht nur einen', async () => {
    const sender = new BroadcastChannel(IDLE_CHANNEL)
    const listeners = [new BroadcastChannel(IDLE_CHANNEL), new BroadcastChannel(IDLE_CHANNEL)]

    const all = Promise.all(listeners.map(channel => new Promise<string>((resolve) => {
      channel.addEventListener('message', event => resolve(event.data as string))
    })))

    sender.postMessage('signed-out')
    await expect(all).resolves.toEqual(['signed-out', 'signed-out'])

    sender.close()
    for (const channel of listeners) channel.close()
  })
})
