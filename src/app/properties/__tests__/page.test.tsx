/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for UserProperties page — add-listing form
 *
 * RED → GREEN cycle:
 *   The bug: inputs & button lived inside a <div>, not a <form>.
 *   On mobile, the virtual keyboard's "Go" key fires a form-submit event.
 *   Without a <form> element the submit went nowhere and nothing happened.
 *   Fix: wrap the fields in <form onSubmit={handleAddProperty}>.
 *
 * These tests were written to describe the INTENDED behaviour first so they
 * fail against a broken implementation and pass once the fix is in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import UserProperties from '../page'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
// Stable reference — if useRouter() returns a new object each call,
// useEffect([router, supabase]) re-fires on every render → infinite loop.
const mockRouter = { push: mockPush }

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

/**
 * Build a thenable, chainable Supabase query stub.
 * The chain resolves to `result` when awaited (or when .maybeSingle() is called).
 */
function makeChain(result: { data: any; error: null }) {
  const chain: any = {}
  const methods = ['select', 'eq', 'in', 'order', 'limit', 'insert']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Make the chain itself awaitable (Supabase fluent API is thenable)
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// Must be defined outside vi.mock() factory and returned as a singleton.
// If createClient() returns a new object on every call, the component's
// useEffect([router, supabase]) re-fires on every render → infinite loop.
const supabaseInstance = {
  from: (table: string) => {
    switch (table) {
      case 'listings_tracker_access_codes': {
        const c = makeChain({ data: [{ property_id: 'prop-1', created_by: 'admin-1', code: 'TEST123' }], error: null })
        c.maybeSingle = vi.fn(() =>
          Promise.resolve({ data: { property_id: 'prop-1', created_by: 'admin-1', code: 'TEST123' }, error: null })
        )
        return c
      }
      case 'listings_tracker_properties':
        return makeChain({ data: [], error: null })
      default:
        return makeChain({ data: [], error: null })
    }
  },
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabaseInstance,
}))


// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  localStorage.setItem(
    'listings_tracker_session',
    JSON.stringify({ code: 'TEST123', expiry: Date.now() + 60_000 })
  )
})

// ── Helper ────────────────────────────────────────────────────────────────────

/** Wait until the <form> is present in the document — loading is done */
async function waitForForm(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), {
    timeout: 3000,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserProperties — add listing form', () => {

  // ── RED test 1 ──────────────────────────────────────────────────────────────
  it('renders a <form> element wrapping the listing inputs (enables mobile keyboard submit)', async () => {
    /**
     * RED: Before the fix the inputs lived in a plain <div>.
     *   container.querySelector('form') returned null → test failed.
     * GREEN: After wrapping in <form onSubmit={...}> this passes.
     */
    const { container } = render(<UserProperties />)
    await waitForForm(container)

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
  })

  // ── RED test 2 ──────────────────────────────────────────────────────────────
  it('triggers the submit handler when the form is submitted (simulates mobile keyboard "Go")', async () => {
    /**
     * RED: Without a <form>, fireEvent.submit had no element to target and the
     *   handler was never called → no error, no action.
     * GREEN: form.onSubmit is wired; fireEvent.submit triggers handleAddProperty
     *   which immediately sets a "required" formError because fields are empty.
     */
    const { container } = render(<UserProperties />)
    await waitForForm(container)

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      const errorEl = container.querySelector('dl-text[color="danger"]')
      expect(errorEl).not.toBeNull()
      expect(errorEl?.textContent).toMatch(/required/i)
    })
  })

  // ── RED test 3 ──────────────────────────────────────────────────────────────
  it('shows a validation error when both fields are empty (desktop & mobile)', async () => {
    /**
     * Both newLink and newPrice are empty: handleAddProperty should set formError.
     */
    const { container } = render(<UserProperties />)
    await waitForForm(container)

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(
        container.querySelector('dl-text[color="danger"]')?.textContent
      ).toMatch(/required/i)
    })
  })

  // ── RED test 4 ──────────────────────────────────────────────────────────────
  it('shows a validation error when only price is missing', async () => {
    const { container } = render(<UserProperties />)
    await waitForForm(container)

    // Capture the form reference before triggering any state-updating events
    const form = container.querySelector('form')!

    // Fire a web-component-style input event with detail.value
    const linkInput = container.querySelector('dl-input[label="Listing Link"]')!
    fireEvent(
      linkInput,
      new CustomEvent('input', {
        detail: { value: 'https://zillow.com/test' },
        bubbles: true,
      })
    )

    fireEvent.submit(form)

    await waitFor(() => {
      expect(
        container.querySelector('dl-text[color="danger"]')?.textContent
      ).toMatch(/required/i)
    })
  })

  // ── Desktop button-click path ─────────────────────────────────────────────
  it('submits validation when the Add Listing button is clicked (desktop / tap)', async () => {
    /**
     * The dl-button onClick path must also fire handleAddProperty.
     */
    const { container } = render(<UserProperties />)
    await waitForForm(container)

    fireEvent.click(container.querySelector('dl-button[variant="primary"]')!)

    await waitFor(() => {
      expect(
        container.querySelector('dl-text[color="danger"]')?.textContent
      ).toMatch(/required/i)
    })
  })
})

