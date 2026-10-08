import { t } from '@/lib/i18n';
import Link from 'next/link';
import { CalendarCheck2, CalendarDays, Settings, Plus, Search, Sun, Moon, Eye, EyeOff, Sparkles } from 'lucide-react';
import React from 'react';
import { useStore } from '@/store';
import { applyTheme } from '@/lib/theme';
import AISearchPanel from './AISearchPanel';

type Props = { onQuickAdd: () => void };

export default function Header({ onQuickAdd }: Props) {
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const [focused, setFocused] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const hideDone = useStore((s) => s.hideDone);
  const toggleHideDone = useStore((s) => s.toggleHideDone);
  React.useEffect(() => {
    // Use the actual applied class on <html> as source of truth
    const read = () => {
      try { return document.documentElement.classList.contains('dark'); } catch { return false; }
    };
    setIsDark(read());
    const onChange = () => setIsDark(read());
    const onTheme = () => setIsDark(read());
    try {
      if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
    } catch {}
    window.addEventListener('clarity-theme-changed', onTheme as EventListener);
    return () => {
      try { if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', onChange); } catch {}
      window.removeEventListener('clarity-theme-changed', onTheme as EventListener);
    };
  }, []);

  return (
    <header className="w-full sticky top-0 z-30 bg-white border-b border-gray-100 dark:bg-slate-950 dark:border-slate-800">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <Link href="/" className="text-lg font-semib...[truncated]