import { describe, it, expect } from 'vitest'
import { object, pipe, string, minLength, trim, email, optional } from 'valibot'
import { flushSync } from 'svelte'
import {
  useFormValidation,
  validationClasses,
  selectValidationClasses,
  textareaValidationClasses
} from './form-validation.svelte'

/**
 * Unit tests for the shared form-validation primitive. The helper relies
 * on Svelte runes, so each test wraps the runes in `$effect.root` to
 * spin up a reactive scope (no component mount needed).
 */

const harnessSchema = object({
  name: pipe(
    string('Bitte einen Namen eingeben.'),
    trim(),
    minLength(1, 'Pflichtfeld.')
  ),
  email: pipe(
    string(),
    trim(),
    email('Bitte eine gültige E-Mail-Adresse eingeben.')
  ),
  bio: optional(pipe(string(), trim(), minLength(10, 'Mindestens 10 Zeichen.')))
})

const setup = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let api: any
  const dispose = $effect.root(() => {
    let name = $state('')
    let emailVal = $state('')
    let bio = $state<string | undefined>(undefined)

    const fv = useFormValidation(harnessSchema, () => ({
      name,
      email: emailVal,
      bio
    }))

    api = {
      fv,
      set name(value: string) {
        name = value
      },
      set email(value: string) {
        emailVal = value
      },
      set bio(value: string | undefined) {
        bio = value
      }
    }
  })

  return { api, dispose }
}

describe('useFormValidation', () => {
  it('starts invalid for an empty required-field form', () => {
    const { api, dispose } = setup()
    try {
      flushSync()
      expect(api.fv.valid).toBe(false)
      expect(api.fv.errors.name).not.toBeNull()
      expect(api.fv.errors.email).not.toBeNull()
    } finally {
      dispose()
    }
  })

  it('keeps `touched` false on initial render', () => {
    const { api, dispose } = setup()
    try {
      flushSync()
      expect(api.fv.touched.name).toBe(false)
      expect(api.fv.touched.email).toBe(false)
    } finally {
      dispose()
    }
  })

  it('flips `valid` to true when every field passes the schema', () => {
    const { api, dispose } = setup()
    try {
      api.name = 'Hans'
      api.email = 'hans@example.com'
      flushSync()
      expect(api.fv.valid).toBe(true)
      expect(api.fv.errors.name).toBeNull()
      expect(api.fv.errors.email).toBeNull()
    } finally {
      dispose()
    }
  })

  it('surfaces the curated German message for a malformed email', () => {
    const { api, dispose } = setup()
    try {
      api.name = 'Hans'
      api.email = 'not-an-email'
      flushSync()
      expect(api.fv.valid).toBe(false)
      expect(api.fv.errors.email).toBe(
        'Bitte eine gültige E-Mail-Adresse eingeben.'
      )
      expect(api.fv.errors.name).toBeNull()
    } finally {
      dispose()
    }
  })

  it('flips a single field touched on `markTouched`', () => {
    const { api, dispose } = setup()
    try {
      flushSync()
      expect(api.fv.touched.name).toBe(false)
      api.fv.markTouched('name')
      flushSync()
      expect(api.fv.touched.name).toBe(true)
      expect(api.fv.touched.email).toBe(false)
    } finally {
      dispose()
    }
  })

  it('flips every field touched on `markAllTouched`', () => {
    const { api, dispose } = setup()
    try {
      flushSync()
      api.fv.markAllTouched()
      flushSync()
      expect(api.fv.touched.name).toBe(true)
      expect(api.fv.touched.email).toBe(true)
      expect(api.fv.touched.bio).toBe(true)
    } finally {
      dispose()
    }
  })

  it('clears every touched flag on `resetTouched`', () => {
    const { api, dispose } = setup()
    try {
      api.fv.markAllTouched()
      flushSync()
      api.fv.resetTouched()
      flushSync()
      expect(api.fv.touched.name).toBe(false)
      expect(api.fv.touched.email).toBe(false)
    } finally {
      dispose()
    }
  })

  it('does NOT gate `valid` on touched — Submit can stay disabled even before any interaction', () => {
    const { api, dispose } = setup()
    try {
      api.name = 'Hans'
      api.email = 'hans@example.com'
      flushSync()
      // No fields were touched, but `valid` should still flip true.
      expect(api.fv.touched.name).toBe(false)
      expect(api.fv.valid).toBe(true)
    } finally {
      dispose()
    }
  })

  it('falls back to "Bitte prüfen Sie Ihre Eingabe." for English Valibot defaults', () => {
    const englishSchema = object({
      thing: pipe(string(), minLength(5)) // no German message
    })
    let api: { fv: ReturnType<typeof useFormValidation> } | null = null
    const dispose = $effect.root(() => {
      let thing = $state('a')
      api = { fv: useFormValidation(englishSchema, () => ({ thing })) } as {
        fv: ReturnType<typeof useFormValidation>
      }
    })
    try {
      flushSync()
      const errors = api!.fv.errors as Record<string, string | null>
      expect(errors.thing).toBe('Bitte prüfen Sie Ihre Eingabe.')
    } finally {
      dispose()
    }
  })
})

describe('validationClasses', () => {
  it('returns the base input class when there is no error', () => {
    expect(validationClasses(null, true)).toBe('input input-bordered w-full')
  })

  it('returns the base input class when the field has not been touched', () => {
    expect(validationClasses('Pflichtfeld.', false)).toBe(
      'input input-bordered w-full'
    )
  })

  it('returns `input-error` when error is set and field is touched', () => {
    expect(validationClasses('Pflichtfeld.', true)).toBe(
      'input input-bordered w-full input-error'
    )
  })

  it('honors a custom base class', () => {
    expect(validationClasses('x', true, 'input input-sm')).toBe(
      'input input-sm input-error'
    )
  })
})

describe('selectValidationClasses', () => {
  it('flips to select-error on touched + invalid', () => {
    expect(selectValidationClasses('err', true)).toBe(
      'select select-bordered w-full select-error'
    )
  })

  it('stays neutral on untouched', () => {
    expect(selectValidationClasses('err', false)).toBe(
      'select select-bordered w-full'
    )
  })
})

describe('textareaValidationClasses', () => {
  it('flips to textarea-error on touched + invalid', () => {
    expect(textareaValidationClasses('err', true)).toBe(
      'textarea textarea-bordered w-full textarea-error'
    )
  })

  it('stays neutral on untouched', () => {
    expect(textareaValidationClasses('err', false)).toBe(
      'textarea textarea-bordered w-full'
    )
  })
})
