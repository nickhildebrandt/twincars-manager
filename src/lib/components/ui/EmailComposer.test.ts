import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'

/**
 * Component tests for EmailComposer — focused on the optional
 * "Als HTML senden" toggle (the broadcast / ad-hoc HTML option).
 *
 * @group unit
 * @module EmailComposer
 */

import EmailComposer from './EmailComposer.svelte'

describe('EmailComposer', () => {
  it('hides the HTML toggle by default (allowHtml off)', () => {
    render(EmailComposer, { props: { subject: '', body: '', attachments: [] } })
    expect(screen.queryByText('Als HTML senden')).toBeNull()
  })

  it('shows the HTML toggle when allowHtml is set', () => {
    render(EmailComposer, {
      props: { subject: '', body: '', attachments: [], allowHtml: true }
    })
    expect(screen.getByText('Als HTML senden')).toBeInTheDocument()
  })

  it('toggling the checkbox switches the message label to HTML mode', async () => {
    const user = userEvent.setup()
    render(EmailComposer, {
      props: { subject: '', body: '', attachments: [], allowHtml: true }
    })
    // Plain-text mode: label has no HTML hint.
    expect(screen.getByText('Nachricht')).toBeInTheDocument()
    expect(screen.queryByText('Nachricht (HTML-Quelltext)')).toBeNull()

    await user.click(screen.getByRole('checkbox', { name: 'Als HTML senden' }))

    expect(screen.getByText('Nachricht (HTML-Quelltext)')).toBeInTheDocument()
  })

  it('reflects an initial asHtml=true prop', () => {
    render(EmailComposer, {
      props: {
        subject: '',
        body: '',
        attachments: [],
        allowHtml: true,
        asHtml: true
      }
    })
    expect(screen.getByText('Nachricht (HTML-Quelltext)')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox', { name: 'Als HTML senden' })
    expect(checkbox).toBeChecked()
  })
})
