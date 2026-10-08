export type ShiftManagerMode = 'single' | 'pattern' | 'month';

export function openShiftManager(date?: string, mode: ShiftManagerMode = 'single') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('open-shift-manager', { detail: { date, mode } }));
}
