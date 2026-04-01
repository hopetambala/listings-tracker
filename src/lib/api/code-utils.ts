/**
 * Code generation utilities for listings-tracker
 */

/**
 * Generate a random 4-digit code (0000-9999)
 */
export function generateCode(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
}

/**
 * Validate a 4-digit code format
 */
export function isValidCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
