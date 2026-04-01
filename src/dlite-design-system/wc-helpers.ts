/**
 * Utility functions for working with web components in React
 */

/**
 * Extract value from web component event
 * Works with both detail and target properties
 */
export function getEventValue(e: any): string {
  return e?.detail?.value ?? e?.target?.value ?? "";
}

/**
 * Extract checked state from web component event
 * Works with both detail and target properties
 */
export function getEventChecked(e: any): boolean {
  return e?.detail?.checked ?? e?.target?.checked ?? false;
}

/**
 * Extract selected option from web component select event
 */
export function getEventSelected(e: any): any {
  return e?.detail?.selected ?? e?.target?.selected ?? null;
}
