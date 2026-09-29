export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'clarity:theme';

export function getStoredTheme(): Theme | null {
  if (typeof localStorage === 'undefined') return null;
  const t = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return t === 'light' || t === 'dark' || t === 'system' ? t : null;
}

export function resolveTheme(pref?: Theme): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = pref ?? getStoredTheme() ?? 'light';
  if (stored === 'light' || stored === 'dark') return stored;
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(next: Theme | 'toggle') {
  if (typeof document === 'undefined') return;
  let current: Theme = getStoredTheme() ?? 'light';
  let target: Theme;
  if (next === 'toggle') {
    // Toggle explicitly between light and dark (ignore system)
    const effective = resolveTheme(current);
    target = effective === 'dark' ? 'light' : 'dark';
  } else {
    target = next;
  }

  try { localStorage.setItem(STORAGE_KEY, target); } catch {}

  const effective = resolveTheme(target);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.style.colorScheme = effective;

  // Update theme-color meta for better iOS/Android appearance
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta) meta.content = effective === 'dark' ? '#0b1730' : '#ffffff';

  // Notify listeners
  try { window.dispatchEvent(new CustomEvent('clarity-theme-changed', { detail: { theme: effective } })); } catch {}
}

// Inline-friendly function to run as early as possible
export function inlineInitThemeScript(): string {
  return `(() => { try {\n    const key = '${STORAGE_KEY}';\n    let pref = localStorage.getItem(key);\n    if (pref !== 'light' && pref !== 'dark' && pref !== 'system') pref = 'light';\n    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;\n    const eff = (pref === 'dark' || (pref === 'system' && sysDark)) ? 'dark' : 'light';\n    document.documentElement.classList.toggle('dark', eff === 'dark');\n    document.documentElement.style.colorScheme = eff;\n  } catch {} })();`;
}
