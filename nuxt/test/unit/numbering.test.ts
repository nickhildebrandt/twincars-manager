/**
 * Number-range templates. The year in a rendered number comes from the
 * business time zone, not from the container's clock (B-028).
 */
import { describe, expect, it } from 'vitest'
import { NUMBER_PLACEHOLDERS, renderNumber, templateHasSequence } from '#shared/numbering'

const AT = new Date('2026-09-13T12:00:00Z')

describe('renderNumber', () => {
  it.each([
    ['{N}', 7, '7'],
    ['{NNNN}', 7, '0007'],
    ['RE-{YYYY}-{NNNN}', 7, 'RE-2026-0007'],
    ['{YY}/{MM}/{NNN}', 7, '26/09/007'],
    ['AU-{YYYY}-{NNNN}', 1234, 'AU-2026-1234'],
    ['S-{N}', 42, 'S-42'],
  ])('%s mit %s ergibt %s', (template, sequence, expected) => {
    expect(renderNumber(template, sequence, AT)).toBe(expected)
  })

  it('kürzt eine zu lange Nummer nicht', () => {
    expect(renderNumber('{NNN}', 123_456, AT)).toBe('123456')
  })

  it('lässt eine Vorlage ohne Platzhalter unverändert', () => {
    expect(renderNumber('fest', 7, AT)).toBe('fest')
  })

  it('nimmt das Jahr aus der Geschäftszeitzone', () => {
    // Silvester 23:30 UTC ist in Berlin schon das neue Jahr.
    expect(renderNumber('RE-{YYYY}-{NNNN}', 1, new Date('2026-12-31T23:30:00Z')))
      .toBe('RE-2027-0001')
  })
})

describe('templateHasSequence', () => {
  it.each(['{N}', '{NNNN}', 'RE-{YYYY}-{NNNN}'])('erkennt %s als brauchbar', (template) => {
    expect(templateHasSequence(template)).toBe(true)
  })

  it.each(['RE-{YYYY}', 'fest', ''])('erkennt %s als unbrauchbar', (template) => {
    // Ohne laufende Nummer bekäme jeder Beleg dieselbe Nummer. Der Vorgänger
    // nahm eine solche Vorlage kommentarlos an.
    expect(templateHasSequence(template)).toBe(false)
  })
})

describe('NUMBER_PLACEHOLDERS', () => {
  it('nennt nur Platzhalter, die auch wirken', () => {
    for (const placeholder of NUMBER_PLACEHOLDERS) {
      expect(renderNumber(placeholder, 1, AT)).not.toBe(placeholder)
    }
  })
})
