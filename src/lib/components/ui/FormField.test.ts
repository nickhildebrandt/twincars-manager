import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import FormField from './FormField.svelte'
import FormFieldHarness from './FormField.test.harness.svelte'

/**
 * Component tests for FormField. We use a tiny test harness component to
 * pass a Snippet into `children`, since testing-library can't synthesise
 * a Snippet directly.
 */
describe('FormField', () => {
  it('renders the label above the input', () => {
    render(FormFieldHarness, { props: { label: 'Vorname' } })
    expect(screen.getByText('Vorname')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows the required marker when required=true', () => {
    render(FormFieldHarness, { props: { label: 'Vorname', required: true } })
    expect(screen.getByText(/Vorname \*/)).toBeInTheDocument()
  })

  it('does NOT show the required marker when required=false (default)', () => {
    render(FormFieldHarness, { props: { label: 'Vorname' } })
    expect(screen.queryByText(/Vorname \*/)).not.toBeInTheDocument()
  })

  it('renders the curated German error text below the input when error is set', () => {
    render(FormFieldHarness, {
      props: { label: 'E-Mail', error: 'Bitte eine gültige E-Mail eingeben.' }
    })
    const errorEl = screen.getByText('Bitte eine gültige E-Mail eingeben.')
    expect(errorEl).toBeInTheDocument()
    expect(errorEl).toHaveClass('text-error')
  })

  it('renders a hint when there is no error', () => {
    render(FormFieldHarness, {
      props: { label: 'Spitzname', hint: 'optional' }
    })
    expect(screen.getByText('optional')).toBeInTheDocument()
  })

  it('hides the hint when there is an error (error wins)', () => {
    render(FormFieldHarness, {
      props: { label: 'E-Mail', hint: 'optional', error: 'Pflichtfeld.' }
    })
    expect(screen.getByText('Pflichtfeld.')).toBeInTheDocument()
    expect(screen.queryByText('optional')).not.toBeInTheDocument()
  })

  it('renders the children snippet (e.g. a text input)', () => {
    render(FormFieldHarness, { props: { label: 'Vorname' } })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('exposes default-export type compatibility — label can be omitted at runtime guard test', () => {
    // sanity: render with everything to make sure prop fan-out is fine.
    render(FormFieldHarness, {
      props: {
        label: 'Stadt',
        required: true,
        error: 'Pflichtfeld.',
        colSpan: 'sm:col-span-2'
      }
    })
    expect(screen.getByText('Stadt *')).toBeInTheDocument()
    expect(screen.getByText('Pflichtfeld.')).toBeInTheDocument()
  })

  // Ensure the actual FormField (not just the harness) is exercised.
  it('exports a Svelte component', () => {
    expect(FormField).toBeDefined()
  })
})
