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
      try { if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', onChange); } cat¶»§q«^