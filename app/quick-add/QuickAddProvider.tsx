'use client';
import { t } from '@/lib/i18n';

import CalendarThemeStyles from '@/components/CalendarThemeStyles';
import ShiftManagerModal from '@/components/ShiftManagerModal';
import Header from '@/components/Header';
import QuickAdd from '@/components/QuickAdd';
import { useEffect, useState } from 'react';
import { setupSWClient } from '@/lib/sw-client';
import { toast } from '@/lib/toast';
import { registerQuickAddOpen } from '@/lib/quickAdd';
import AutoScheduleModal from '@/components/AutoScheduleModal';

export default function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialText, setInitialText] = useState('');
  const [initialMode, setInitialMode] = useState<'quick'|'notes'>('quick');
  const [initialSheet, setInitialSheet] = useState<'event'|'task'>('event');
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const [initialDirect, setInitialDirect] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        // Toggle Quick Add on Cmd/Ctrl+K
        setOpen((prev) => {
          if (prev) return false; // close if already open
          setInitialText('');
          setInitialMode('quick');
          setInitialSheet('event');
          setInitialDate(undefined);
          setInitialDirect(false);
          return true; // open otherwise
        });
      }
    };
    window.addEventListener('keydown', onKey);
    registerQuickAddOpen((prefill, options) => {
      setInitialText(prefill ?? '');
      setInitialMode(options?.mode || 'quick');
      setInitialSheet(options?.sheet || 'event');
      setInitialDate(options?.date);
      setInitialDirect(!!options?.direct);
      setOpen(true);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      registerQuickAddOpen(() => {});
    };
  }, []);

  useEffect(() => {
    setupSWClient(() => toast(t("An update is available. Reload to apply.")));
  }, []);

  return (
    <>
      <CalendarThemeStyles />
      <Header onQuickAdd={() => { setInitialText(''); setInitialMode('quick'); setInitialSheet('event'); setInitialDate(undefined); setInitialDirect(false); setOpen(true); }} />
      {children}
      <QuickAdd open={open} initialText={initialText} initialMode={initialMode} initialSheet={initialSheet} initialDate={initialDate} initialDirect={initialDirect} onClose={() => setOpen(false)} />
      <ShiftManagerModal />
      <AutoScheduleModal />
    </>
  );
}
