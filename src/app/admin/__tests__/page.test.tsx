/**
 * TDD tests for AdminAuth — login / sign-up / forgot-password forms
 *
 * RED → GREEN cycle:
 *   Tests describe the three submit paths (sign-in, sign-up, forgot-password)
 *   and their error/success states. A broken implementation (missing supabase
 *   call, wrong error colour, no confirmation text) fails these tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import AdminAuth from '../page'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockRouter = { push: mockPush }
vi.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockResetPassword = vi.fn()
const mockGetUser = vi.fn()

const supabaseInstance = {
  auth: {
    getUser: mockGetUser,
    signInWithPassword: mockSignIn,
    signUp: mockSignUp,
    resetPasswordForEmail: mockResetPassword,
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseInstance }))

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
  // Default: no user logged in, all auth calls succeed
  mockGetUser.mockResolvedValue({ data: { user: null } })
  mockSignIn.mockResolvedValue({ error: null })
  mockSignUp.mockResolvedValue({ error: null })
  mockResetPassword.mockResolvedValue({ error: null })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

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

describe('AdminAuth — sign-in form', () => {

  // ── RED: missing <form> means keyboard submit does nothing
  it('renders a <form> element', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)
    expect(container.querySelector('form')).not.toBeNull()
  })

  // ── RED: wrong supabase method called → sign-in never fires
  it('calls signInWithPassword with the entered email and password', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    const inputs = container.querySelectorAll('dl-input')
    fireInput(inputs[0], 'admin@test.com')
    fireInput(inputs[1], 'secret123')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'secret123',
      })
    )
  })

  // ── RED: error state not wired → user never sees feedback
  it('displays the error message when sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/invalid login credentials/i)
    })
  })
})

describe('AdminAuth — sign-up form', () => {

  // ── RED: toggle not wired → signUp never called
  it('calls signUp after switching to sign-up mode', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Need an account')

    const inputs = container.querySelectorAll('dl-input')
    fireInput(inputs[0], 'new@test.com')
    fireInput(inputs[1], 'password123')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'password123',
      })
    )
  })

  // ── RED: no confirmation message → user doesn't know to check email
  it('shows email-confirmation message after successful sign-up', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Need an account')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() =>
      expect(container.textContent).toMatch(/check your email/i)
    )
  })

  // ── RED: sign-up error not propagated → user sees blank screen
  it('shows error message when sign-up fails', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } })
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Need an account')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/already registered/i)
    })
  })
})

describe('AdminAuth — forgot-password form', () => {

  // ── RED: forgot-password path not wired → resetPasswordForEmail never called
  it('calls resetPasswordForEmail with the entered email', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Forgot password')

    const emailInput = container.querySelector('dl-input')!
    fireInput(emailInput, 'user@test.com')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith(
        'user@test.com',
        expect.objectContaining({ redirectTo: expect.any(String) })
      )
    )
  })

  // ── RED: no confirmation → user retries endlessly
  it('shows a confirmation message after a reset email is sent', async () => {
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Forgot password')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() =>
      expect(container.textContent).toMatch(/check your email/i)
    )
  })

  // ── RED: reset error swallowed → user sees nothing
  it('shows error when resetPasswordForEmail fails', async () => {
    mockResetPassword.mockResolvedValue({ error: { message: 'Email not found' } })
    const { container } = render(<AdminAuth />)
    await waitForForm(container)

    clickByText(container, 'Forgot password')
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      const el = container.querySelector('dl-text[color="tertiary"]')
      expect(el?.textContent).toMatch(/email not found/i)
    })
  })
})
