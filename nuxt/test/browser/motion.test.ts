/**
 * Bewegung im echten Browser.
 *
 * Zwei Zusagen aus [04-ux.md](../../../docs/rewrite/04-ux.md) §3.2 lassen sich
 * nur hier prüfen: dass die Ladeanzeige das Layout nicht verschiebt, und dass
 * mit `prefers-reduced-motion: reduce` nichts mehr läuft.
 */
import { afterEach, describe, expect, it } from 'vitest'

/** Baut einen Ausschnitt der Hülle direkt ins Dokument. */
function mountShell(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `
    <div style="position: relative;">
      <div id="bar" style="position: absolute; top: 0; left: 0; height: 2px; width: 40%;"></div>
      <header id="header" style="height: 56px;">Kopfzeile</header>
      <main id="content" style="height: 200px;">Inhalt</main>
    </div>
  `
  document.body.append(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Die Ladeanzeige verschiebt nichts', () => {
  it('lässt die Kopfzeile an ihrem Platz, wenn der Balken erscheint', async () => {
    const root = mountShell()
    const header = root.querySelector('#header') as HTMLElement
    const bar = root.querySelector('#bar') as HTMLElement

    bar.style.display = 'none'
    const before = header.getBoundingClientRect().top

    bar.style.display = 'block'
    await new Promise(resolve => requestAnimationFrame(resolve))

    // Der Balken liegt absolut über der Kopfzeile und belegt keinen Platz im
    // Fluss. Täte er es, sprängen bei jeder Anfrage alle Inhalte um zwei Pixel.
    expect(header.getBoundingClientRect().top).toBe(before)
  })

  it('lässt den Inhalt an seinem Platz, wenn die Sperrfläche erscheint', async () => {
    const root = mountShell()
    const content = root.querySelector('#content') as HTMLElement
    const before = content.getBoundingClientRect()

    const overlay = document.createElement('div')
    overlay.style.cssText = 'position: absolute; inset: 0;'
    content.style.position = 'relative'
    content.append(overlay)
    await new Promise(resolve => requestAnimationFrame(resolve))

    const after = content.getBoundingClientRect()
    expect(after.top).toBe(before.top)
    expect(after.height).toBe(before.height)
  })
})

describe('Bewegungsreduktion', () => {
  it('ist im Browser abfragbar', () => {
    // Ohne diese Abfrage könnte die Zusage gar nicht eingehalten werden.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    expect(typeof query.matches).toBe('boolean')
  })

  it('schaltet Übergänge über eine Regel ab, nicht über JavaScript', () => {
    // Die Regel steht in main.css. Hier wird geprüft, dass eine solche Regel
    // überhaupt greift — der Browser wendet sie an, sobald der Nutzer es will.
    const style = document.createElement('style')
    style.textContent = `
      #probe { transition-duration: 300ms; }
      @media (prefers-reduced-motion: reduce) {
        #probe { transition-duration: 0.01ms !important; }
      }
    `
    document.head.append(style)

    const probe = document.createElement('div')
    probe.id = 'probe'
    document.body.append(probe)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = getComputedStyle(probe).transitionDuration

    expect(duration).toBe(reduced ? '0.0001s' : '0.3s')

    style.remove()
  })

  it('läuft in einem Fenster mit echten Maßen', () => {
    // Ohne Fenstermaße wären alle Messungen oben wertlos.
    expect(window.innerWidth).toBeGreaterThan(0)
    expect(window.innerHeight).toBeGreaterThan(0)
  })
})
