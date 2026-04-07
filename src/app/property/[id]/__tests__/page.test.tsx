/**
 * TDD tests for PropertyDetail — inline edit forms + add-price + key-photo
 *
 * RED → GREEN cycle:
 *   The page has no single <form> element; each section is an inline
 *   edit pattern (show → edit mode → save).  Tests verify that
 *   the correct supabase calls are made for each mutation.
 *   A broken implementation that wires the wrong table or omits the
 *   call entirely fails here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import PropertyDetail from '../page'

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

// Shared chain instances — tests can inspect .mock.calls
const propChain = makeChain({
  data: {
    id: 'prop-123',
    admin_id: 'admin-1',
    listing_link: 'https://zillow.com/test',
    street_address: '99 Oak Ave',
    mls_number: 'MLS-777',
    listing_price: 400000,
    sold_price: null,
    notes: 'Great location',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  error: null,
})

const codeChain = makeChain({
  data: { id: 'code-1', property_id: 'prop-123', code: 'TEST' },
  error: null,
})

const pricesChain = makeChain({ data: [], error: null })

const photosChain = makeChain({
  data: [
    {
      id: 'photo-1',
      property_id: 'prop-123',
      photo_url: 'https://example.com/photo1.jpg',
      display_order: 0,
      is_key_photo: false,
      uploaded_at: '2024-01-01T00:00:00Z',
      uploaded_by: null,
      notes: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'photo-2',
      property_id: 'prop-123',
      photo_url: 'https://example.com/photo2.jpg',
      display_order: 1,
      is_key_photo: false,
      uploaded_at: '2024-01-01T00:00:00Z',
      uploaded_by: null,
      notes: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  error: null,
})

const supabaseInstance = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'listings_tracker_properties': return propChain
      case 'listings_tracker_access_codes': return codeChain
      case 'listings_tracker_prices': return pricesChain
      case 'listings_tracker_photos': return photosChain
      default: return makeChain({ data: null, error: null })
    }
  }),
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseInstance }))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  localStorage.setItem(
    'listings_tracker_session',
    JSON.stringify({ code: 'TEST', expiry: Date.now() + 60_000 })
  )
  vi.spyOn(window, 'alert').mockImplementation(() => {})

  // Re-wire from() after clearAllMocks
  supabaseInstance.from.mockImplementation((table: string) => {
    switch (table) {
      case 'listings_tracker_properties': return propChain
      case 'listings_tracker_access_codes': return codeChain
      case 'listings_tracker_prices': return pricesChain
      case 'listings_tracker_photos': return photosChain
      default: return makeChain({ data: null, error: null })
    }
  })

  // Restore chain methods
  for (const chain of [propChain, codeChain, pricesChain, photosChain]) {
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.single.mockResolvedValue(chain.then === undefined ? {} : { data: (chain as any)._data, error: null })
  }

  propChain.single.mockResolvedValue({
    data: {
      id: 'prop-123', admin_id: 'admin-1',
      listing_link: 'https://zillow.com/test',
      street_address: '99 Oak Ave', mls_number: 'MLS-777',
      listing_price: 400000, sold_price: null,
      notes: 'Great location',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  })
  codeChain.single.mockResolvedValue({
    data: { id: 'code-1', property_id: 'prop-123', code: 'TEST' },
    error: null,
  })
  pricesChain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject)
  photosChain.then = (resolve: any, reject: any) =>
    Promise.resolve({
      data: [
        {
          id: 'photo-1', property_id: 'prop-123',
          photo_url: 'https://example.com/photo1.jpg',
          display_order: 0, is_key_photo: false,
          uploaded_at: '2024-01-01T00:00:00Z', uploaded_by: null,
          notes: null, created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'photo-2', property_id: 'prop-123',
          photo_url: 'https://example.com/photo2.jpg',
          display_order: 1, is_key_photo: false,
          uploaded_at: '2024-01-01T00:00:00Z', uploaded_by: null,
          notes: null, created_at: '2024-01-01T00:00:00Z',
        },
      ],
      error: null,
    }).then(resolve, reject)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait until loading is complete (spinner gone, heading present) */
async function waitForLoad(container: HTMLElement) {
  await waitFor(
    () => {
      expect(container.querySelector('dl-spinner')).toBeNull()
      expect(container.textContent).toMatch(/99 Oak Ave/i)
    },
    { timeout: 5000 }
  )
}

function fireInput(el: Element, value: string) {
  fireEvent(el, new CustomEvent('input', { detail: { value }, bubbles: true }))
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll('dl-button, button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`Button with text "${text}" not found`)
  fireEvent.click(btn)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PropertyDetail — add price form', () => {

  // ── RED: empty submit calls supabase with NaN price
  it('shows an alert when Add Price is clicked with empty input', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    clickByText(container, 'Add Price')

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
  })

  // ── RED: insert not called → price never saved
  it('inserts a price record when a valid price is entered', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    const priceInput = container.querySelector('dl-input[type="number"]')!
    fireInput(priceInput, '390000')
    clickByText(container, 'Add Price')

    await waitFor(() => {
      expect(pricesChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'prop-123',
          price: 390000,
        })
      )
    })
  })
})

describe('PropertyDetail — inline address edit', () => {

  // ── RED: update not called → address change lost
  it('calls supabase update when a new address is saved', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    // Enter edit mode
    clickByText(container, 'Edit')

    const addressInput = container.querySelector('dl-input[label="Address"]')!
    fireInput(addressInput, '123 New Street')
    clickByText(container, 'Save')

    await waitFor(() => {
      expect(propChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ street_address: '123 New Street' })
      )
    })
  })

  // ── RED: empty address guard missing → blank address stored
  it('shows an alert when address is saved empty', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    clickByText(container, 'Edit')

    // Clear the input
    const addressInput = container.querySelector('dl-input[label="Address"]')!
    fireInput(addressInput, '')
    clickByText(container, 'Save')

    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
  })
})

describe('PropertyDetail — inline notes edit', () => {

  // ── RED: update not called → notes change lost
  it('calls supabase update when notes are saved', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    // Find and click the "Edit" button in the Notes section
    const notesSection = Array.from(container.querySelectorAll('dl-button')).find(
      (b) => b.textContent === 'Edit' || b.textContent === 'Add'
    )
    // There may be multiple Edit buttons; click the one nearest to the Notes heading
    const allEditBtns = Array.from(container.querySelectorAll('dl-button')).filter(
      (b) => b.textContent === 'Edit' || b.textContent === 'Add'
    )
    // Last "Edit"/"Add" button is Notes (Address Edit is first, Notes is later)
    fireEvent.click(allEditBtns[allEditBtns.length - 1])

    const textarea = container.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'Updated notes text' } })
    clickByText(container, 'Save')

    await waitFor(() => {
      expect(propChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Updated notes text' })
      )
    })
  })
})

describe('PropertyDetail — key photo', () => {

  // ── RED: photos not rendered → no key photo button visible
  it('renders a "Set as key photo" button for non-key photos', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    await waitFor(() => {
      expect(container.textContent).toMatch(/Set as key photo/i)
    })
  })

  // ── RED: update not called → key photo never persisted
  it('calls supabase update to set is_key_photo=true when the button is clicked', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    await waitFor(() =>
      expect(container.textContent).toMatch(/Set as key photo/i)
    )

    clickByText(container, 'Set as key photo')

    await waitFor(() => {
      expect(photosChain.update).toHaveBeenCalledWith({ is_key_photo: true })
    })
  })

  // ── RED: old key photo not cleared → multiple photos marked as key
  it('first clears existing key photos before setting the new one', async () => {
    const { container } = render(<PropertyDetail />)
    await waitForLoad(container)

    await waitFor(() =>
      expect(container.textContent).toMatch(/Set as key photo/i)
    )

    clickByText(container, 'Set as key photo')

    await waitFor(() => {
      // First update clears all key photos for the property
      expect(photosChain.update).toHaveBeenCalledWith({ is_key_photo: false })
      // Then sets the selected photo
      expect(photosChain.update).toHaveBeenCalledWith({ is_key_photo: true })
    })
  })
})
