/**
 * Secrets at rest.
 *
 * B-018: the predecessor's cipher refused to run without a key, but the
 * session layer next to it silently fell back to a fixed development secret.
 * Nothing here invents a key, and the environment check at startup makes sure
 * one exists.
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { envSchema } from '#shared/schemas/env'
import {
  decryptSecret,
  decryptSecretIfNeeded,
  deriveKey,
  encryptSecret,
  isEncryptedSecret,
  maskSecret,
} from '../../server/utils/crypto.ts'

const key = deriveKey('a-secret-that-is-long-enough-for-a-test')
const other = deriveKey('a-different-secret-of-sufficient-length')

describe('encryptSecret und decryptSecret', () => {
  it('ist rundlauffähig', () => {
    const plain = 'hunter2'
    expect(decryptSecret(encryptSecret(plain, key), key)).toBe(plain)
  })

  it.each([
    ['leerer Text', ''],
    ['Umlaute', 'Grüße aus Süddeutschland'],
    ['Sonderzeichen', 'p@ss:wort:mit:doppelpunkten'],
    ['lang', 'x'.repeat(10_000)],
  ])('überlebt %s', (_name, plain) => {
    expect(decryptSecret(encryptSecret(plain, key), key)).toBe(plain)
  })

  it('erzeugt für denselben Text zweimal verschiedene Chiffrate', () => {
    // Ein fester Initialisierungsvektor würde verraten, dass zwei Einträge
    // dasselbe Geheimnis tragen.
    expect(encryptSecret('gleich', key)).not.toBe(encryptSecret('gleich', key))
  })

  it('schreibt das Format v1:iv:tag:daten', () => {
    const parts = encryptSecret('x', key).split(':')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('v1')
  })
})

describe('Manipulation wird bemerkt', () => {
  it('lehnt ein verändertes Chiffrat ab', () => {
    const encrypted = encryptSecret('geheim', key)
    const parts = encrypted.split(':')
    const data = Buffer.from(parts[3]!, 'base64')
    data[0] = data[0]! ^ 0xff
    parts[3] = data.toString('base64')
    expect(() => decryptSecret(parts.join(':'), key)).toThrow()
  })

  it('lehnt den falschen Schlüssel ab', () => {
    expect(() => decryptSecret(encryptSecret('geheim', key), other)).toThrow()
  })

  it.each([
    ['unbekannte Version', 'v2:a:b:c'],
    ['zu wenige Teile', 'v1:a:b'],
    ['gar kein Chiffrat', 'klartext'],
  ])('lehnt %s ab', (_name, value) => {
    expect(() => decryptSecret(value, key)).toThrow('Unbekanntes Chiffrat-Format.')
  })
})

describe('isEncryptedSecret', () => {
  it('erkennt ein eigenes Chiffrat', () => {
    expect(isEncryptedSecret(encryptSecret('x', key))).toBe(true)
  })

  it.each(['', 'klartext', 'v1:zuwenig', 'v2:a:b:c'])('erkennt %s als Klartext', (value) => {
    expect(isEncryptedSecret(value)).toBe(false)
  })
})

describe('decryptSecretIfNeeded', () => {
  it('entschlüsselt ein Chiffrat', () => {
    expect(decryptSecretIfNeeded(encryptSecret('geheim', key), key)).toBe('geheim')
  })

  it('reicht eine alte Klartextzeile unverändert durch', () => {
    // Zeilen aus der Zeit vor der Verschlüsselung bleiben lesbar; das nächste
    // Speichern schreibt sie verschlüsselt zurück.
    expect(decryptSecretIfNeeded('altes-klartext-passwort', key)).toBe('altes-klartext-passwort')
  })
})

describe('maskSecret', () => {
  it.each([
    ['hunter2', '••••ter2'],
    ['abcd', '••••'],
    ['', '••••'],
  ])('zeigt von %s nur %s', (value, masked) => {
    expect(maskSecret(value)).toBe(masked)
  })
})

describe('Regression', () => {
  it('B-018: ohne gesetztes Geheimnis startet die Anwendung nicht', () => {
    // Der Vorgänger war in sich widersprüchlich: die Verschlüsselung weigerte
    // sich ohne Schlüssel, die Sitzungsschicht daneben fiel still auf ein
    // festes Entwicklungsgeheimnis zurück. Eine Produktivinstanz konnte damit
    // mit öffentlich bekanntem Schlüssel laufen.
    const withoutSecret = v.safeParse(envSchema, {
      DATABASE_URL: 'postgres://localhost/twincars',
    })
    expect(withoutSecret.success).toBe(false)
    expect(withoutSecret.issues?.map(issue => issue.message)).toContain('APP_SECRET fehlt.')

    // In der Produktion reicht APP_SECRET allein nicht: der Chiffrierschlüssel
    // ist dort ein eigener Wert.
    const production = v.safeParse(envSchema, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost/twincars',
      APP_SECRET: 'x'.repeat(40),
      ORIGIN: 'https://twincars.example',
    })
    expect(production.success).toBe(false)
    expect(production.issues?.map(issue => issue.message)).toContain(
      'APP_ENCRYPTION_KEY muss in der Produktion gesetzt sein (mindestens 32 Zeichen).',
    )

    // Und es gibt keinen eingebauten Ersatzschlüssel: ohne Schlüssel wird
    // nicht verschlüsselt, sondern geworfen.
    expect(() => encryptSecret('geheim', undefined as unknown as Buffer)).toThrow()
  })
})
