import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import PostForm from './PostForm.svelte'
import { formDirty } from '$lib/stores/form-dirty.svelte'

/**
 * Component tests for PostForm — required title/body validation,
 * trimmed payload, publish toggle, and the wrapping publish help
 * text (the DaisyUI `.label` nowrap default is overridden so the
 * sentence stays readable on phone widths).
 *
 * @group component
 * @module PostForm
 */
describe('PostForm', () => {
  beforeEach(() => {
    formDirty.clear()
  })

  it('renders the core labels and the publish help text', () => {
    render(PostForm, { props: { onSave: vi.fn() } })
    expect(screen.getByText('Titel *')).toBeInTheDocument()
    expect(screen.getByText('Inhalt *')).toBeInTheDocument()
    expect(screen.getByText('Veröffentlicht')).toBeInTheDocument()
    expect(
      screen.getByText(/Nur veröffentlichte Beiträge erscheinen/i)
    ).toBeInTheDocument()
  })

  it('lets the publish help text wrap (no .label nowrap)', () => {
    render(PostForm, { props: { onSave: vi.fn() } })
    const label = screen
      .getByText('Veröffentlicht')
      .closest('label') as HTMLLabelElement
    expect(label.className).toContain('whitespace-normal')
    expect(label.className).toContain('items-start')
  })

  it('keeps Speichern enabled even while title/body are empty (rule 1.1)', () => {
    render(PostForm, { props: { onSave: vi.fn() } })
    expect(
      screen.getByRole('button', { name: /speichern/i })
    ).not.toBeDisabled()
  })

  it('rejects a submit without content and shows a German error', async () => {
    const onSave = vi.fn()
    const { container } = render(PostForm, { props: { onSave } })
    const form = container.querySelector('form') as HTMLFormElement
    await fireEvent.submit(form)
    expect(onSave).not.toHaveBeenCalled()
    expect(
      screen.getAllByText(/Bitte einen Titel eingeben/i).length
    ).toBeGreaterThan(0)
  })

  it('emits trimmed title + body and the published flag', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(PostForm, {
      props: {
        onSave,
        initial: { title: '  Neuigkeit  ', body: 'Inhaltstext' }
      }
    })
    await user.click(screen.getByText('Veröffentlicht'))
    await user.click(screen.getByRole('button', { name: /speichern/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.title).toBe('Neuigkeit')
    expect(payload.body).toBe('Inhaltstext')
    expect(payload.published).toBe(true)
  })

  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(PostForm, { props: { onSave: vi.fn(), onCancel } })
    await user.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
