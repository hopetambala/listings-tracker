/**
 * TDD tests for Home — access code entry form
 *
 * RED → GREEN cycle:
 *   These tests describe intended behaviour first.
 *   They fail against an implementation that skips validation or
 *   omits the <form> element, and pass once the feature is correct.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import Home from '../page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockRouter = { push: mockPush }

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  localStorage.clear()
})

// ── Helper ────────────────────────────────────────────────────────────────────

function fireInputEvent(el: Element, value: string) {
  fireEvent(el, new CustomEvent('input', { detail: { value }, bubbles: true }))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Home — access code form', () => {

  // ── RED: missing <form> would make mobile keyboard "Go" do nothing
  it('renders a <form> element so mobile keyboard submit works', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('form')).not.toBeNull()
  })

  // ── RED: without disabled check, button fires even with empty input
  it('button is disabled when no code has been entered', () => {
    const { container } = render(<Home />)
    const btn = container.querySelector('dl-button[variant="primary"]')
    // disabled attribute is set when code.length !== 4
    expect(btn?.hasAttribute('disabled')).toBe(true)
  })

  // ── RED: without 4-char guard, any length would navigate
  it('does not navigate when code is fewer than 4 digits', async () => {
    const { container } = render(<Home />)
    fireInputEvent(container.querySelector('dl-input')!, '12')
    fireEvent.submit(container.querySelector('form')!)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockPush).not.toHaveBeenCalledWith('/properties')
  })

  // ── RED: missing localStorage write would leave no session
  it('stores session in localStorage and navigates when a 4-digit code is submitted', async () => {
    const { container } = render(<Home />)
    fireInputEvent(container.querySelector('dl-input')!, '1234')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/properties'))

    const session = JSON.parse(localStorage.getItem('listings_tracker_session')!)
    expect(session.code).toBe('1234')
    expect(session.expiry).toBeGreaterThan(Date.now())
  })

  // ── RED: without session check, already-authed users would see the form again
  it('immediately redirects to /properties when a valid session already exists', async () => {
    localStorage.setItem(
      'listings_tracker_session',
      JSON.stringify({ code: '5678', expiry: Date.now() + 60_000 })
    )
    render(<Home />)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/properties'))
  })

  // ── RED: without non-digit filtering, "ab12" would be stored as-is
  it('strips non-digit characters from the code input', async () => {
    const { container } = render(<Home />)
    // Fire a value that includes non-digit chars; the handler slices to 4 digits
    fireInputEvent(container.querySelector('dl-input')!, 'ab12')
    fireEvent.submit(container.querySelector('form')!)
    // Code after stripping "ab" is "12" — only 2 digits, so no navigation
    await new Promise((r) => setTimeout(r, 50))
    expect(mockPush).not.toHaveBeenCalledWith('/properties')
  })
})
