export function openAutoSchedule(taskId?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('open-auto-schedule', { detail: { taskId } }));
}
