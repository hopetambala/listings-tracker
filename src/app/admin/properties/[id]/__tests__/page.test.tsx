/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for EditProperty — admin edit-property form
 *
 * RED → GREEN cycle:
 *   Tests verify that the form pre-fills with the loaded property data,
 *   that submit fires the correct UPDATE call, and that errors surface.
 *   A broken implementation that skips pre-fill or calls INSERT instead
 *   of UPDATE would fail these tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import EditProperty from '../page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockRouter = { push: mockPush }
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: 'prop-123' }),
}))

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

const mockProperty = {
  id: 'prop-123',
  admin_id: 'admin-1',
  listing_link: 'https://zillow.com/existing',
  street_address: '42 Elm St',
  mls_number: 'MLS999',
  listing_price: 500000,
  sold_price: null,
  notes: 'Nice place',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const propChain = makeChain({ data: mockProperty, error: null })

const supabaseInstance = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: { id: 'admin-1', email: 'admin@test.com' } } })
    ),
  },
  from: vi.fn(() => propChain),
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseInstance }))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  supabaseInstance.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1', email: 'admin@test.com' } },
  })
  supabaseInstance.from.mockReturnValue(propChain)
  // Reset chain spy call counts
  for (const key of Object.keys(propChain)) {
    if (typeof propChain[key]?.mockReset === 'function') propChain[key].mockReset()
    if (typeof propChain[key] === 'function' && propChain[key].mock) {
      propChain[key].mockReturnValue(propChain)
    }
  }
  // Re-wire single to return the property
  propChain.single.mockResolvedValue({ data: mockProperty, error: null })
  propChain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: mockProperty, error: null }).then(resolve, reject)
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update']) {
    propChain[m] = vi.fn(() => propChain)
  }
})

// ── Helper ────────────────────────────────────────────────────────────────────

async function waitForForm(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector('form')).not.toBeNull(), {
    timeout: 3000,
  })
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll('dl-button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`Button with text "${text}" not found`)
  fireEvent.click(btn)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EditProperty — edit property form', () => {

  // ── RED: no form rendered → nothing to edit
  it('renders a <form> element once property data is loaded', async () => {
    const { container } = render(<EditProperty />)
    await waitForForm(container)
    expect(container.querySelector('form')).not.toBeNull()
  })

  // ── RED: form not pre-filled → user must re-enter all fields
  it('pre-fills inputs with existing property data', async () => {
    const { container } = render(<EditProperty />)
    await waitForForm(container)

    // The url input should have the existing listing_link as its value attribute
    const urlInput = container.querySelector('dl-input[type="url"]')
    expect(urlInput?.getAttribute('value')).toBe('https://zillow.com/existing')

    // The price input should have the existing listing_price
    const priceInput = container.querySelector('dl-input[type="number"]')
    expect(priceInput?.getAttribute('value')).toBe('500000')
  })

  // ── RED: update not called → changes are silently discarded
  it('calls supabase update when the form is submitted', async () => {
    const { container } = render(<EditProperty />)
    await waitForForm(container)

    clickByText(container, 'Save Changes')

    await waitFor(() => {
      expect(propChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          listing_link: 'https://zillow.com/existing',
          listing_price: 500000,
        })
      )
    })
  })

  // ── RED: successful update does not redirect → user stuck on edit page
  it('redirects to /admin/properties after a successful update', async () => {
    // update chain resolves with no error
    propChain.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject)

    const { container } = render(<EditProperty />)
    await waitForForm(container)

    clickByText(container, 'Save Changes')

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/properties')
    )
  })

  // ── RED: update error swallowed → user sees nothing wrong
  it('displays the error message when update fails', async () => {
    propChain.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: null, error: { message: 'Permission denied' } }).then(
        resolve,
        reject
      )

    const { container } = render(<EditProperty />)
    await waitForForm(container)

    clickByText(container, 'Save Changes')

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/permission denied/i)
    })
  })
})
