'use client';
import { t, interpolate } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import CalendarThemeSettings from '@/components/CalendarThemeSettings';
import ShiftSettings from '@/components/ShiftSettings';
import FreeTimeSettings from '@/components/FreeTimeSettings';
import { normalizeCategory } from '@/lib/calendar/categories';
import ExportModal from '@/components/ExportModal';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import { isGoogleEnabled } from '@/lib/google';
import { AI_MODEL_OPTIONS, DEFAULT_MODEL_ID, LS_AI_KEY, getStoredAIModel, setStoredAIModel } from '@/lib/ai';
import { Bot, Key, Database, Upload, Download, CalendarDays, Plug, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const createTask = useStore((s) => s.createTask);
  const refresh = useStore((s) => s.refresh);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [editingKey, setEditingKey] = useState<boolean>(false);
  const [keyDraft, setKeyDraft] = useState<string>('');
  const [aiTestState, setAiTestState] = useState<'idle'|'testing'|'ok'|'fail'>('idle');

  useEffect(() => {
    try {
      setModelId(getStoredAIModel());
      setHasKey(!!localStorage.getItem(LS_AI_KEY));
    } catch {}
  }, []);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const rows = csvToRows(text);
        const header = rows.shift() || [];
        const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name);
        const titleIdx = idx('title');
        if (titleIdx === -1) throw new Error(t("CSV must include a \"title\" column."));
        let created = 0;
        for (const r of rows) {
          const get = (n: string) => {
            const i = idx(n);
            return i >= 0 ? r[i] : '';
          };
          const title = r[titleIdx];
          if (!title) continue;
          const stage = (get('stage') || 'todo') as any;
          const start = get('start') || undefined;
          const end = get('end') || undefined;
          const checked = parseBool(get('checked')) || false;
          const parentId = get('parentId') || null;
          const calendarId = get('calendarId') || 'local';
          await (createTask as any)({
            title,
            category: normalizeCategory(get('category')),
            description: undefined,
            stage,
            checked,
            start,
            end,
            deadline: get('deadline') || undefined,
            estimatedMinutes: get('estimatedminutes') ? Number(get('estimatedminutes')) : undefined,
            priority: ['high','medium','low'].includes(get('priority')) ? get('priority') : 'medium',
            allDay: false,
            hiddenOnCalendar: false,
            linkedTo: undefined,
            parentId,
            subTasks: undefined,
            calendarId,
          });
          created++;
        }
        toast(interpolate('importedCount', { count: created }));
        await (refresh as any)();
      } catch (err) {
        toast(interpolate('importFailed', { message: (err as Error).message }));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="py-6 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-semibold">{t("Settings")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t("Configure AI, data, and integrations.")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalendarThemeSettings />
        <ShiftSettings />
        <FreeTimeSettings />
        {/* AI Assistant */}
        <section className="card p-4 space-y-3">
          <div>
            <h2 className="font-medium flex items-center gap-2"><Bot className="w-4 h-4 text-gray-500" /> {t("AI Assistant")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("Choose a model and add your API key. Keys are stored locally and masked.")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2"><Bot className="w-3.5 h-3.5" /> {t("Model")}</span>
              <select className="input" value={modelId} onChange={(e)=>{ const id = e.target.value; setModelId(id); try { setStoredAIModel(id); } catch {} }}>
                {AI_MODEL_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2"><Key className="w-3.5 h-3.5" /> {t("API Key")}</span>
              {!hasKey || editingKey ? (
                <div className="flex gap-2">
                  <input className="input flex-1" type="password" value={keyDraft} onChange={(e)=>setKeyDraft(e.target.value)} placeholder={t("Paste your Gemini API key")} />
                  <button className="btn" onClick={()=>{
                    if (!keyDraft.trim()) { toast(t("Enter a valid API key")); return; }
                    try { localStorage.setItem(LS_AI_KEY, keyDraft.trim()); } catch {}
                    setKeyDraft('');
                    setHasKey(true);
                    setEditingKey(false);
                    toast(t("API key saved"));
                  }}>{t("Save")}</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input className="input flex-1" type="password" value="••••••••••" disabled readOnly />
                  <button className="btn" onClick={()=>{ setEditingKey(true); setKeyDraft(''); }}>{t("Replace")}</button>
                  <button className="btn" onClick={()=>{ try { localStorage.removeItem(LS_AI_KEY); } catch {}; setHasKey(false); setEditingKey(false); setAiTestState('idle'); toast(t("API key cleared")); }}>{t("Clear")}</button>
                </div>
              )}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <TestButton hasKey={hasKey} state={aiTestState} onClick={async ()=>{
              if (!hasKey || aiTestState === 'testing') return;
              setAiTestState('testing');
              try {
                const apiKey = (()=>{ try { return localStorage.getItem(LS_AI_KEY) || ''; } catch { return ''; } })();
                const resp = await fetch('/api/ai/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: modelId, apiKey, messages: [{ role: 'user', content: 'Reply with: pong' }] }),
                });
                const data = await resp.json();
                const ok = data?.ok && String(data?.content || '').toLowerCase().includes('pong');
                setAiTestState(ok ? 'ok' : 'fail');
              } catch (e) {
                setAiTestState('fail');
              } finally {
                setTimeout(()=> setAiTestState('idle'), 2000);
              }
            }} />
          </div>
        </section>

        {/* Data */}
        <section className="card p-4 space-y-3">
          <div>
            <h2 className="font-medium flex items-center gap-2"><Database className="w-4 h-4 text-gray-500" /> {t("Data")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("Export a backup or import tasks from CSV.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => setExportOpen(true)}><Download className="w-4 h-4" /> {t("Export…")}</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImport} />
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /> {t("Import CSV…")}</button>
          </div>
          <p className="text-xs text-gray-500">{t("CSV must include a &quot;title&quot; column. Other columns are optional.")}</p>
        </section>

        {/* Integrations */}
        <section className="card p-4 space-y-3 lg:col-span-2">
          <div>
            <h2 className="font-medium flex items-center gap-2"><Plug className="w-4 h-4 text-gray-500" /> {t("Integrations")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("Connect external services.")}</p>
          </div>
          {isGoogleEnabled() ? (
            <button className="btn" onClick={() => alert(t("Connect Google Calendar (beta) is not available in local mode."))}> <CalendarDays className="w-4 h-4"/> {t("Connect Google Calendar (beta)")}</button>
          ) : (
            <p className="text-sm text-gray-500">{t("Google Calendar integration appears disabled in this environment.")}</p>
          )}
        </section>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

function useRef<T>(initial: T | null) {
  const [ref] = useState({ current: initial } as { current: T | null });
  return ref;
}

function parseBool(val: string | undefined): boolean | undefined {
  if (val == null) return undefined;
  const s = val.trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return undefined;
}

 

function csvToRows(csv: string): string[][] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  });
}

function TestButton({ hasKey, state, onClick }: { hasKey: boolean; state: 'idle'|'testing'|'ok'|'fail'; onClick: () => void }) {
  let cls = 'btn transition-all';
  let label = t("Test connection");
  let icon: JSX.Element | null = null;

  if (!hasKey) {
    cls += ' opacity-60 cursor-not-allowed';
  }

  switch (state) {
    case 'testing':
      cls += ' btn-primary animate-pulse';
      label = t("Testing…");
      icon = <Loader2 className="w-4 h-4 animate-spin" />;
      break;
    case 'ok':
      cls += ' bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent ring-2 ring-emerald-400/40';
      label = t("Connected");
      icon = <CheckCircle2 className="w-4 h-4" />;
      break;
    case 'fail':
      cls += ' bg-rose-600 hover:bg-rose-600/90 text-white border-transparent ring-2 ring-rose-400/40';
      label = t("Try again");
      icon = <XCircle className="w-4 h-4" />;
      break;
    default:
      // idle
      break;
  }

  return (
    <button className={cls} onClick={onClick} disabled={!hasKey || state === 'testing'} aria-live="polite">
      {icon}
      {label}
    </button>
  );
}
