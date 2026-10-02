export function openShiftManager(date?: string, mode: 'single' | 'pattern' = 'single') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('open-shift-manager', { detail: { date, mode } }));
}
