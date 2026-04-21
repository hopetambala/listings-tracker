/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for BulkUpload — CSV upload form
 *
 * RED → GREEN cycle:
 *   Tests cover empty-input guard, invalid CSV parse errors surfaced in the UI,
 *   and the happy-path insert loop.  A broken implementation that skips parse
 *   errors or never calls supabase insert fails here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import BulkUpload from '../page'

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

// Insert chain: .insert().select().single() → returns a single property object
const mockPropInsertChain = makeChain({ data: { id: 'bulk-prop-1' }, error: null })
// Duplicate-check chain: .select().eq() resolves as an array (no .single())
const mockPropSelectChain = makeChain({ data: [], error: null })
const mockCodeChain = makeChain({ data: null, error: null })

// Persistent insert spy — shared across all property chains so tests can inspect it
const mockPropInsert = vi.fn(() => mockPropInsertChain)

const supabaseInstance = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: { id: 'admin-1' } } })
    ),
  },
  from: vi.fn((table: string) => {
    if (table === 'listings_tracker_properties') {
      // Return a chain where .insert() delegates to the shared mockPropInsert spy
      const chain = { ...mockPropSelectChain }
      chain.insert = mockPropInsert
      return chain
    }
    if (table === 'listings_tracker_access_codes') return mockCodeChain
    return makeChain({ data: null, error: null })
  }),
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseInstance }))
vi.mock('@/lib/api/code-utils', () => ({ generateCode: () => '1111' }))

// Spy on toasts — the real module has no-op listeners in tests, we just need
// to observe error calls in place of the old alert().
const toastErrorSpy = vi.fn()
const toastSuccessSpy = vi.fn()
vi.mock('@/components/Toast', () => ({
  toast: {
    error: (msg: string) => toastErrorSpy(msg),
    success: (msg: string) => toastSuccessSpy(msg),
    info: (_msg: string) => {},
  },
  showToast: () => {},
  ToastContainer: () => null,
}))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  // Re-wire mockPropInsert to return mockPropInsertChain after clearAllMocks
  mockPropInsert.mockReturnValue(mockPropInsertChain)
  // Restore chain methods on mockPropInsertChain after clearAllMocks
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'update']) {
    mockPropInsertChain[m] = vi.fn(() => mockPropInsertChain)
  }
  mockPropInsertChain.single = vi.fn(() => Promise.resolve({ data: { id: 'bulk-prop-1' }, error: null }))
  mockPropInsertChain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: { id: 'bulk-prop-1' }, error: null }).then(resolve, reject)
  // Restore mockPropSelectChain methods after clearAllMocks
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'update']) {
    mockPropSelectChain[m] = vi.fn(() => mockPropSelectChain)
  }
  mockPropSelectChain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject)
  // Restore mockCodeChain methods after clearAllMocks
  for (const m of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update']) {
    mockCodeChain[m] = vi.fn(() => mockCodeChain)
  }
  mockCodeChain.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: null, error: null }).then(resolve, reject)
  supabaseInstance.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
  supabaseInstance.from.mockImplementation((table: string) => {
    if (table === 'listings_tracker_properties') {
      const chain = { ...mockPropSelectChain }
      chain.insert = mockPropInsert
      return chain
    }
    if (table === 'listings_tracker_access_codes') return mockCodeChain
    return makeChain({ data: null, error: null })
  })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  toastErrorSpy.mockReset()
  toastSuccessSpy.mockReset()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForUploadButton(container: HTMLElement) {
  await waitFor(
    () => {
      const btn = Array.from(container.querySelectorAll('dl-button')).find((b) =>
        b.textContent?.includes('Preview CSV')
      )
      expect(btn).not.toBeUndefined()
    },
    { timeout: 3000 }
  )
}

function fireTextarea(container: HTMLElement, value: string) {
  const ta = container.querySelector('dl-textarea')!
  fireEvent(ta, new CustomEvent('input', { detail: { value }, bubbles: true }))
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll('dl-button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`Button with text "${text}" not found`)
  fireEvent.click(btn)
}

// Helper for the new two-step flow: preview then confirm.
async function runPreviewAndUpload(container: HTMLElement) {
  clickByText(container, 'Preview CSV')
  await waitFor(() => {
    const btn = Array.from(container.querySelectorAll('dl-button')).find((b) =>
      b.textContent?.includes('Confirm upload')
    )
    expect(btn).not.toBeUndefined()
  })
  clickByText(container, 'Confirm upload')
}

const VALID_CSV = `listing_link,street_address,mls_number,listing_price,notes
https://zillow.com/123-main,123 Main St,MLS001,450000,Nice home`

const INVALID_CSV = `no_listing_link_column,listing_price
value,450000`

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkUpload — CSV upload form', () => {

  // ── RED: no form elements → nothing to upload
  it('renders the upload textarea and button after auth resolves', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)
    expect(container.querySelector('dl-textarea')).not.toBeNull()
  })

  // ── Empty-input guard now uses toast.error() instead of alert()
  it('fires an error toast when Preview is clicked with empty CSV text', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    clickByText(container, 'Preview CSV')

    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled())
  })

  it('renders CSV parse errors in the UI when required column is missing', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    fireTextarea(container, INVALID_CSV)
    clickByText(container, 'Preview CSV')

    await waitFor(() => {
      expect(container.textContent).toMatch(/missing required column/i)
    })
  })

  it('inserts a property record for each valid CSV row after confirmation', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    fireTextarea(container, VALID_CSV)
    await runPreviewAndUpload(container)

    await waitFor(() => {
      expect(mockPropInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'admin-1',
          listing_link: 'https://zillow.com/123-main',
          listing_price: 450000,
        })
      )
    })
  })

  it('inserts an access code for each successfully created property', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    fireTextarea(container, VALID_CSV)
    await runPreviewAndUpload(container)

    await waitFor(() => {
      expect(mockCodeChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 'bulk-prop-1',
          code: '1111',
          created_by: 'admin-1',
        })
      )
    })
  })

  it('shows the results view with success count after upload completes', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    fireTextarea(container, VALID_CSV)
    await runPreviewAndUpload(container)

    await waitFor(() => {
      expect(container.textContent).toMatch(/upload complete/i)
      expect(container.textContent).toMatch(/1 created/i)
    })
  })

  it('resets back to the upload form when "Upload More" is clicked', async () => {
    const { container } = render(<BulkUpload />)
    await waitForUploadButton(container)

    fireTextarea(container, VALID_CSV)
    await runPreviewAndUpload(container)

    await waitFor(() => expect(container.textContent).toMatch(/upload complete/i))

    clickByText(container, 'Upload More')

    await waitFor(() => {
      expect(container.querySelector('dl-textarea')).not.toBeNull()
      expect(container.textContent).not.toMatch(/upload complete/i)
    })
  })
})
