export type QuickAddOptions = {
  mode?: 'quick'|'notes';
  sheet?: 'event'|'task';
  date?: string;
  direct?: boolean;
};

export type QuickAddOpen = (prefill?: string, options?: QuickAddOptions) => void;

let opener: QuickAddOpen | null = null;

export function registerQuickAddOpen(fn: QuickAddOpen) {
  opener = fn;
}

export function openQuickAdd(prefill?: string, options?: QuickAddOptions) {
  if (opener) opener(prefill, options);
}
