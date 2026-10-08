'use client';
import { t } from '@/lib/i18n';

import CalendarThemeStyles from '@/components/CalendarThemeStyles';
import ShiftManagerModal from '@/components/ShiftManagerModal';
import Header from '@/components/Header';
import QuickAdd from '@/components/QuickAdd';
import { useEffect, useState } from 'react';
import { setupSWClient } from '@/lib/sw-client';
import { toast } from '@/lib/toast';
import { registerQuickAddOpen, type QuickAddOptions } from '@/lib/quickAdd';
import AutoScheduleModal from '@/components/AutoScheduleModal';

export default function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialText, setInitialText] = useState('');
  const [initialMode, setInitialMode] = useState<'quick'|'notes'>('quick');
  const [initialOptions, setInitialOptions] = useState<QuickAddOptions>({ sheet: 'event' });

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
          setInitialOptions({ sheet: 'event' });
          return true; // open otherwise
        });
      }
    };
    window.addEventListener('keydown', onKey);
    registerQuickAddOpen((prefill, options) => {
      setInitialText(prefill ?? '');
      setInitialMode(options?.mode || 'quick');
      setInitialOptions(options || { sheet: 'event' });
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
      <Header onQuickAdd={() => { setInitialText(''); setInit...[truncated]