/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for NewProperty — admin create-property form
 *
 * RED → GREEN cycle:
 *   Tests cover required-field validation (no supabase hit) and the happy path
 *   (two sequential inserts: property + access code).  A broken implementation
 *   that skips validation or calls the wrong table fails here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import NewProperty from '../page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockRouter = { push: mockPush }
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

// ── Supabase chain helper ─────────────────────────────────────────────────────

function makeChain(result: { data: any; error: any }) {
  const chain: any = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// Track inserts so tests can assert what was sent
const mockPropertyChain = makeChain({
  data: { id: 'new-prop-id', listing_price: 450000 },
  error: null,
})
const mockCodesChain = makeChain({ data: null, error: null })
// empty codes list for the "load existing codes" query
const mockCodesSelectChain = makeChain({ data: [], error: null })

const supabaseInstance = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: { id: 'admin-1', email: 'admin@test.com' } } })
    ),
  },
  from: vi.fn((table: string) => {
    if (table === 'listings_tracker_properties') return mockPropertyChain
    if (table === 'listings_tracker_access_codes') return mockCodesSelectChain
    return makeChain({ data: null, error: null })
  }),
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseInstance }))
vi.mock('@/lib/api/code-utils', () => ({ generateCode: () => '9999' }))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  // Re-wire after clearAllMocks
  supabaseInstance.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1', email: 'admin@test.com' } },
  })
  supabaseInstance.from.mockImplementation((table: string) => {
    if (table === 'listings_tracker_properties') return mockPropertyChain
    if (table === 'listings_tracker_access_codes') return mockCodesSelectChain
    return makeChain({ data: null, error: null })
  })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

// ── Helper ────────────────────────────────────────────────────────────────────

async function waitForForm(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), {
    timeout: 3000,
  })
}

function fireInput(el: Element, value: string) {
  fireEvent(el, new CustomEvent('input', { detail: { value }, bubbles: true }))
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll('dl-button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`Button with text "${text}" not found`)
  fireEvent.click(btn)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewProperty — create property form', () => {

  // ── RED: no form rendered → nothing is submittable
  it('renders a <form> element once auth resolves', async () => {
    const { container } = render(<NewProperty />)
    await waitForForm(container)
    expect(container.querySelector('form')).not.toBeNull()
  })

  // ── RED: missing validation → empty form hits supabase with bad data
  it('shows a validation error when both required fields are empty', async () => {
    const { container } = render(<NewProperty />)
    await waitForForm(container)

    clickByText(container, 'Create Property')

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/link and price are required/i)
    })
  })

  // ── RED: partial-validation miss → missing price goes unnoticed
  it('shows a validation error when listing price is missing', async () => {
    const { container } = render(<NewProperty />)
    await waitForForm(container)

    // Fill only the link
    const linkInput = container.querySelector('dl-input[type="url"]')!
    fireInput(linkInput, 'https://zillow.com/test')

    clickByText(container, 'Create Property')

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/link and price are required/i)
    })
  })

  // ── RED: supabase not called → property never saved
  it('inserts a property record when required fields are provided', async () => {
    const { container } = render(<NewProperty />)
    await waitForForm(container)

    fireInput(container.querySelector('dl-input[type="url"]')!, 'https://zillow.com/test')
    fireInput(container.querySelector('dl-input[type="number"]')!, '450000')

    clickByText(container, 'Create Property')

    await waitFor(() => {
      expect(mockPropertyChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin-1',
          listing_link: 'https://zillow.com/test',
          listing_price: 450000,
        })
      )
    })
  })

  // ── RED: access code insert skipped → property not accessible to user
  it('inserts an access code record linked to the new property', async () => {
    const { container } = render(<NewProperty />)
    await waitForForm(container)

    // Wire the access codes chain for insert (separate from the select chain)
    supabaseInstance.from.mockImplementation((table: string) => {
      if (table === 'listings_tracker_properties') return mockPropertyChain
      if (table === 'listings_tracker_access_codes') return mockCodesChain
      return makeChain({ data: null, error: null })
    })

    fireInput(container.querySelector('dl-input[type="url"]')!, 'https://zillow.com/test')
    fireInput(container.querySelector('dl-input[type="number"]')!, '450000')

    clickByText(container, 'Create Property')

    await waitFor(() => {
      expect(mockCodesChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'new-prop-id',
          created_by: 'admin-1',
        })
      )
    })
  })

  // ── RED: supabase error swallowed → user sees a blank form, not an error
  it('displays the error message when the property insert fails', async () => {
    supabaseInstance.from.mockImplementation((table: string) => {
      if (table === 'listings_tracker_properties')
        return makeChain({ data: null, error: { message: 'Duplicate entry' } })
      return makeChain({ data: null, error: null })
    })

    const { container } = render(<NewProperty />)
    await waitForForm(container)

    fireInput(container.querySelector('dl-input[type="url"]')!, 'https://zillow.com/test')
    fireInput(container.querySelector('dl-input[type="number"]')!, '450000')
    clickByText(container, 'Create Property')

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/duplicate entry/i)
    })
  })
})
