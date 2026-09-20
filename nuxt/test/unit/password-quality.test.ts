/**
 * Die Passwortprüfung (P-14, E-23).
 *
 * Es gibt keinen zweiten Faktor. Das Passwort ist die einzige Hürde, also
 * wird hier geprüft, ob sie eine ist — und zwar an den Passwörtern, die
 * Menschen wirklich wählen, nicht an ausgedachten Gegenbeispielen.
 */
import { describe, expect, it } from 'vitest'
import {
  MINIMUM_LENGTH,
  OFFLINE_NOTICE,
  breachMessage,
  checkPasswordLocally,
} from '#shared/password-quality'

/** Kurz und lesbar: nur die Frage „durchgelassen oder nicht". */
const accepts = (password: string, context = {}) =>
  checkPasswordLocally(password, context).ok

describe('P-14: die Mindestlänge', () => {
  it('P-14: weist alles unter zwölf Zeichen ab', () => {
    expect(accepts('Kurz1!aB')).toBe(false)
    expect(checkPasswordLocally('Kurz1!aB').problems[0]).toContain('zwölf'.length ? '12' : '')
  })

  it('P-14: lässt eine Losung aus drei Wörtern durch', () => {
    // Das erklärte Ziel: Länge statt Zusammensetzungsregeln. Kein
    // Sonderzeichen, keine Ziffer — und trotzdem in Ordnung.
    expect(accepts('kupplung wechsel dienstag')).toBe(true)
  })

  it('P-14: die Grenze liegt bei zwölf', () => {
    expect(MINIMUM_LENGTH).toBe(12)
    expect(accepts('abcdefghijk')).toBe(false)
    expect(accepts('rhabarberkuchen')).toBe(true)
  })

  it('P-14: verlangt kein Sonderzeichen und keine Ziffer', () => {
    // `Passwort1!` erfüllt jede Zusammensetzungsregel und steht in jeder
    // Leckliste. Solche Regeln erzeugen genau dieses Passwort.
    const verdict = checkPasswordLocally('nordseewindmuehle')
    expect(verdict.ok).toBe(true)
    expect(verdict.problems).toEqual([])
  })
})

describe('P-14: die Muster, die in der Praxis fallen', () => {
  it('P-14: weist `sommer2024` ab — der Fall aus dem Arbeitsplan', () => {
    const verdict = checkPasswordLocally('sommer2024!!')
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.some(problem => problem.includes('Jahreszahl'))).toBe(true)
  })

  it.each([
    'Winter2026!!',
    'Dortmund1998',
    'Fussball2011',
    'Mustermann2026',
  ])('P-14: weist %s ab — Wort plus Jahreszahl', (password) => {
    expect(accepts(password)).toBe(false)
  })

  it('P-14: weist Tastaturreihen ab', () => {
    expect(accepts('qwertzuiopas')).toBe(false)
    expect(accepts('asdfghjklqwe')).toBe(false)
    expect(accepts('123456789012')).toBe(false)
  })

  it('P-14: weist zu wenige verschiedene Zeichen ab', () => {
    expect(accepts('aaaaaaaaaaaa')).toBe(false)
    expect(accepts('abababababab')).toBe(false)
  })

  it('P-14: durchschaut die Ziffernersetzung', () => {
    // `P4ssw0rt` ist `passwort`, und das weiß jeder Angreifer auch.
    expect(accepts('P4ssw0rt1234')).toBe(false)
    expect(accepts('W3rkst4ttXYZ')).toBe(false)
  })

  it('P-14: weist ein bekanntes Wort mit angehängten Ziffern ab', () => {
    expect(accepts('administrator42')).toBe(false)
    expect(accepts('willkommen1234')).toBe(false)
  })

  it('P-14: weist führende und abschließende Leerzeichen ab', () => {
    // Sie sind beim Anmelden nicht zu sehen und kosten eine halbe Stunde.
    expect(accepts(' rhabarberkuchen')).toBe(false)
    expect(accepts('rhabarberkuchen ')).toBe(false)
  })
})

describe('P-14: der eigene Name und der Firmenname', () => {
  const context = {
    username: 'aschmitt',
    displayName: 'Anna Schmitt',
    companyName: 'Autohaus Muster GmbH',
    email: 'anna.schmitt@muster.de',
  }

  it.each([
    ['den Benutzernamen', 'aschmitt-langgenug'],
    ['den Nachnamen', 'schmitt-und-mehr'],
    ['den Vornamen', 'annaistdiebeste'],
    ['den Firmennamen', 'autohaus-schrauber'],
    ['einen Teil der Firma', 'mustermusterxyz'],
  ])('P-14: weist %s ab', (_what, password) => {
    expect(accepts(password, context)).toBe(false)
  })

  it('P-14: verbietet nicht die Rechtsform', () => {
    // Sonst wäre jedes Passwort mit „gmbh" darin abgelehnt, und das sagt
    // über den Betrieb nichts aus.
    expect(accepts('gmbhundgmbhundkuchen', context)).toBe(true)
  })

  it('P-14: verbietet nicht jedes Füllwort', () => {
    expect(accepts('und der die das kuchen', context)).toBe(true)
  })

  it('P-14: nennt genau einen Satz dafür, auch bei mehreren Treffern', () => {
    const verdict = checkPasswordLocally('anna-schmitt-aschmitt', context)
    const hits = verdict.problems.filter(problem => problem.includes('Firmennamen'))
    expect(hits.length).toBe(1)
  })

  it('P-14: ohne Zusammenhang wird nur das Allgemeine geprüft', () => {
    expect(accepts('aschmitt-langgenug')).toBe(true)
    expect(accepts('twincarsmanager99')).toBe(false)
  })
})

describe('P-14: alle Beanstandungen auf einmal', () => {
  it('P-14: nennt Länge und Name in einem Durchgang', () => {
    // Wer zweimal hintereinander abgewiesen wird, wählt beim dritten Mal
    // etwas Schlechteres.
    const verdict = checkPasswordLocally('anna1', { displayName: 'Anna Schmitt' })
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.length).toBeGreaterThanOrEqual(2)
  })

  it('P-14: ein gutes Passwort hat eine leere Liste', () => {
    expect(checkPasswordLocally('kupplung wechsel dienstag')).toEqual({
      ok: true,
      problems: [],
    })
  })

  it('P-14: ein leeres Passwort wird abgewiesen', () => {
    expect(accepts('')).toBe(false)
  })
})

describe('E-23: der Satz zum Abgleich', () => {
  it('E-23: nicht gefunden heißt kein Satz', () => {
    expect(breachMessage(0)).toBeNull()
  })

  it('E-23: gefunden nennt die Zahl', () => {
    expect(breachMessage(7)).toContain('7-mal')
    expect(breachMessage(7)).toContain('Datenlecks')
  })

  it('E-23: bei sehr vielen Funden wird gerundet', () => {
    // „23 897-mal gefunden" liest niemand. „über 23-tausendmal" schon.
    expect(breachMessage(23_897)).toContain('23-tausendmal')
  })

  it('E-23: nicht prüfbar ist kein Fehlersatz, sondern ein Hinweis', () => {
    // Der Unterschied zwischen „geprüft und sauber" und „nicht geprüft" muss
    // sichtbar bleiben. Eine Prüfung, die still durchwinkt, erzeugt
    // Vertrauen, das sie nicht deckt.
    expect(breachMessage(null)).toBeNull()
    expect(OFFLINE_NOTICE).toContain('nicht möglich')
    expect(OFFLINE_NOTICE).toContain('Mindestanforderung ist erfüllt')
  })
})
