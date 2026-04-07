/**
 * Utility functions for working with web components in React
 */

export type WcInputEvent = CustomEvent<{ value: string }>;
export type WcCheckedEvent = CustomEvent<{ checked: boolean }>;
export type WcSelectedEvent = CustomEvent<{ selected: unknown }>;

export function getEventValue(e: WcInputEvent): string {
  return (
    e?.detail?.value ??
    (e as unknown as { nativeEvent?: { detail?: { value?: string } } })?.nativeEvent?.detail?.value ??
    (e?.target as HTMLInputElement)?.value ??
    ""
  );
}

export function getEventChecked(e: WcCheckedEvent): boolean {
  return e?.detail?.checked ?? (e?.target as HTMLInputElement)?.checked ?? false;
}

export function getEventSelected(e: WcSelectedEvent): unknown {
  return e?.detail?.selected ?? (e?.target as HTMLSelectElement)?.value ?? null;
}
