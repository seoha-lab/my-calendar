'use client';
import { t, interpolate } from '@/lib/i18n';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { containsKorean, parseKoreanInput, parseQuickInput, extractDateTimeHints, type ParsedEvent, type ParsedHint, type ParsedKoreanInput } from '@/lib/nlp';
import { z } from 'zod';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import { LS_AI_KEY, LS_AI_MODEL, DEFAULT_MODEL_ID } from '@/lib/ai';
import { CalendarDays, CheckSquare2, Keyboard, Loader2, Trash2, Wand2, ListPlus, Plus } from 'lucide-react';
import CategorySelect from './CategorySelect';
import type { EventCategory } from '@/lib/calendar/categories';
import DateTimePicker from '@/components/DateTimePicker';
import QuickAddPreview from '@/components/QuickAddPreview';
import TaskSchedulingFields, { type TaskSchedulingValue } from '@/components/TaskSchedulingFields';

const schema = z.object({ title: z.string().min(1) });

type Props = {
  open: boolean;
  onClose: () => void;
  initialText?: string;
  initialMode?: 'quick'|'notes';
  initialSheet?: 'event'|'task';
  initialDate?: string;
  initialDirect?: boolean;
};

type DirectEventDraft = {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  category: EventCategory;
  location: string;
  note: string;
};

function localDateKey(date = new Date()) {
  return String(date.getFullYear()) + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}

function defaultDirect(date?: string): DirectEventDraft {
  return { title:'', date:date || localDateKey(), allDay:false, startTime:'09:00', endTime:'10:00', category:'other', location:'', note:'' };
}

export default function QuickAdd({ open, onClose, initialText='', initialMode='quick', initialSheet='event', initialDate, initialDirect=false }: Props) {
  const [text, setText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<ParsedHint[]>([]);
  const [mode, setMode] = useState<'quick'|'notes'>('quick');
  const [sheet, setSheet] = useState<'event'|'task'>('event');
  const [direct, setDirect] = useState(false);
  const [directEvent, setDirectEvent] = useState<DirectEventDraft>(() => defaultDirect());
  const [preview, setPreview] = useState<ParsedKoreanInput | null>(null);
  const [planning, setPlanning] = useState<TaskSchedulingValue>({ priority:'medium' });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const createTask = useStore((s) => s.createTask);

  useEffect(() => {
    if (!open) return;
    setText(initialText || '');
    setTaskTitle('');
    setCategory('other');
    setPreview(null);
    setPlanning({ priority:'medium' });
    setMode(initialMode || 'quick');
    setSheet(initialSheet || 'event');
    setDirect(!!initialDirect);
    setDirectEvent(defaultDirect(initialDate));
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, initialText, initialMode, initialSheet, initialDate, initialDirect]);

  useEffect(() => {
    try { setHints(text ? extractDateTimeHints(text) : []); } catch { setHints([]); }
  }, [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const buildHighlightHTML = (value: string, spans: ParsedHint[]) => {
    if (!value) return '';
    const esc = (v: string) => v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const sorted=[...spans].sort((a,b)=>(a.start-b.start)||(a.end-b.end));
    let html=''; let i=0;
    for (const h of sorted) {
      if (h.start < i) continue;
      if (h.start > i) html += esc(value.slice(i,h.start));
      const cls = h.kind==='time' ? 'qa-inline-time' : h.kind==='date' ? 'qa-inline-date' : 'qa-inline-datetime';
      html += '<span class="qa-inline ' + cls + '">' + esc(value.slice(h.start,h.end)) + '</span>';
      i=h.end;
    }
    if (i<value.length) html += esc(value.slice(i));
    return html;
  };

  const enterDirect = () => {
    let next = defaultDirect(initialDate);
    const source=text.trim();
    if (source) {
      if (containsKorean(source)) {
        const parsed=parseKoreanInput(source,new Date());
        if (parsed.kind==='event') {
          next={ title:parsed.title || source, date:parsed.date || next.date, allDay:!!parsed.allDay, startTime:parsed.startTime || next.startTime, endTime:parsed.endTime || next.endTime, category:parsed.category, location:parsed.location || '', note:parsed.note || '' };
        }
      } else next.title=source;
    }
    setDirectEvent(next);
    setDirect(true);
    setError(null);
  };

  const submitNatural = () => {
    const value=text.trim();
    if (!value) { setError('일정을 입력해 주세요.'); return; }
    if (containsKorean(value)) { setPreview(parseKoreanInput(value,new Date())); setError(null); return; }
    const result=parseQuickInput(value);
    if (result.errors?.length) { setError(result.errors.join(', ')); return; }
    const parsed=schema.safeParse({ title:result.task.title ?? '' });
    if (!parsed.success) { setError('일정 제목을 입력해 주세요.'); return; }
    const start=result.task.start ? new Date(result.task.start) : new Date();
    const end=result.task.end ? new Date(result.task.end) : new Date(start.getTime()+3600000);
    const date=localDateKey(start);
    const startTime=String(start.getHours()).padStart(2,'0') + ':' + String(start.getMinutes()).padStart(2,'0');
    const endTime=String(end.getHours()).padStart(2,'0') + ':' + String(end.getMinutes()).padStart(2,'0');
    setPreview({ kind:'event', title:result.task.title || value, category, date, startTime, endTime, allDay:!!result.task.allDay, confidence:1, ambiguities:[] });
  };

  const previewDirect = () => {
    if (!directEvent.title.trim()) { setError('일정 이름을 입력해 주세요.'); return; }
    if (!directEvent.date) { setError('날짜를 선택해 주세요.'); return; }
    if (!directEvent.allDay && (!directEvent.startTime || !directEvent.endTime)) { setError('시작시간과 종료시간을 선택해 주세요.'); return; }
    const event: ParsedEvent = {
      kind:'event', title:directEvent.title.trim(), date:directEvent.date,
      startTime:directEvent.allDay ? undefined : directEvent.startTime,
      endTime:directEvent.allDay ? undefined : directEvent.endTime,
      allDay:directEvent.allDay, category:directEvent.category,
      location:directEvent.location.trim() || undefined, note:directEvent.note.trim() || undefined,
      confidence:1, ambiguities:[],
    };
    setPreview(event);
    setError(null);
  };

  const saveTask = async () => {
    const title=taskTitle.trim();
    if (!title) { setError('할 일 이름을 입력해 주세요.'); return; }
    try {
      await createTask({ title, category, deadline:planning.deadline, priority:planning.priority ?? 'medium', stage:'todo', checked:false, isEvent:false, hiddenOnCalendar:false, parentId:null, calendarId:'local' } as any);
      toast('할 일을 저장했습니다.');
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '할 일을 저장하지 못했습니다.'); }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="추가" className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="card max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto p-4 sm:p-5">
        {preview ? (
          <QuickAddPreview value={preview} onChange={setPreview} onBack={()=>setPreview(null)} onSaved={()=>{setPreview(null);onClose();}} />
        ) : mode==='notes' ? (
          <DraftFromNotesInsideQuickAdd onClose={onClose} textAreaRef={notesRef} />
        ) : (
          <div className="space-y-4">
            <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-slate-800" role="tablist" aria-label="추가할 항목">
              <button type="button" role="tab" aria-selected={sheet==='event'} className={'flex-1 rounded-lg px-3 py-2 text-sm font-semibold ' + (sheet==='event'?'bg-white shadow-sm dark:bg-slate-700':'text-gray-500')} onClick={()=>{setSheet('event');setError(null);}}><CalendarDays className="mr-1.5 inline h-4 w-4"/>일정</button>
              <button type="button" role="tab" aria-selected={sheet==='task'} className={'flex-1 rounded-lg px-3 py-2 text-sm font-semibold ' + (sheet==='task'?'bg-white shadow-sm dark:bg-slate-700':'text-gray-500')} onClick={()=>{setSheet('task');setError(null);}}><CheckSquare2 className="mr-1.5 inline h-4 w-4"/>할 일</button>
            </div>

            {sheet==='event' ? (
              direct ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">일정 직접 입력</p><p className="text-xs text-gray-500">날짜, 시간, 카테고리를 직접 선택합니다.</p></div><button type="button" className="btn" onClick={()=>setDirect(false)}>자연어 입력</button></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>일정 이름</span><input className="input" value={directEvent.title} onChange={(e)=>setDirectEvent({...directEvent,title:e.target.value})} placeholder="예: 교수님 미팅"/></label>
                    <label className="flex flex-col gap-1 text-sm"><span>날짜</span><input className="input" type="date" value={directEvent.date} onChange={(e)=>setDirectEvent({...directEvent,date:e.target.value})}/></label>
                    <CategorySelect value={directEvent.category} onChange={(nextCategory)=>setDirectEvent({...directEvent,category:nextCategory})}/>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={directEvent.allDay} onChange={(e)=>setDirectEvent({...directEvent,allDay:e.target.checked})}/>하루 종일</label>
                    {!directEvent.allDay && <>
                      <label className="flex flex-col gap-1 text-sm"><span>시작시간</span><input className="input" type="time" value={directEvent.startTime} onChange={(e)=>setDirectEvent({...directEvent,startTime:e.target.value})}/></label>
                      <label className="flex flex-col gap-1 text-sm"><span>종료시간</span><input className="input" type="time" value={directEvent.endTime} onChange={(e)=>setDirectEvent({...directEvent,endTime:e.target.value})}/></label>
                    </>}
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>장소</span><input className="input" value={directEvent.location} onChange={(e)=>setDirectEvent({...directEvent,location:e.target.value})} placeholder="장소 없음"/></label>
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>메모</span><textarea className="input min-h-20" value={directEvent.note} onChange={(e)=>setDirectEvent({...directEvent,note:e.target.value})}/></label>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white pt-3 pb-[max(4px,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900"><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" onClick={previewDirect}>저장 전 확인</button></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div><label className="mb-1 block text-sm font-medium">일정 자연어 입력</label><div className="relative">
                    <div aria-hidden className="absolute inset-0 pointer-events-none px-3 py-2 whitespace-pre overflow-hidden select-none qa-inline-layer" dangerouslySetInnerHTML={{__html:buildHighlightHTML(text,hints)}}/>
                    <button type="button" className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900" onClick={enterDirect}><Keyboard className="mr-1 inline h-3.5 w-3.5"/>Tab · 직접 입력</button>
                    <input ref={inputRef} className="input pr-32" aria-label="일정 자연어 입력" placeholder="예: 매주 월수금 오전 9시 수영" value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{if(e.key==='Tab'){e.preventDefault();enterDirect();}else if(e.key==='Enter'){e.preventDefault();submitNatural();}}} style={{background:'transparent',position:'relative'}}/>
                  </div></div>
                  <div className="flex items-center justify-between gap-3"><button type="button" className="text-xs text-gray-500 underline-offset-4 hover:underline" onClick={()=>setMode('notes')}>메모에서 여러 항목 추가</button><span className="text-xs text-gray-500">Enter로 확인 · Tab으로 직접 입력</span></div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white pt-3 pb-[max(4px,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900"><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={!text.trim()} onClick={submitNatural}>내용 확인</button></div>
                </div>
              )
            ) : (
              <div className="space-y-4">
                <label className="flex flex-col gap-1 text-sm"><span className="font-medium">할 일 이름</span><input className="input" aria-label="할 일 이름" value={taskTitle} onChange={(e)=>setTaskTitle(e.target.value)} placeholder="예: 논문 초록 수정"/></label>
                <CategorySelect value={category} onChange={setCategory}/>
                <TaskSchedulingFields value={planning} onChange={(patch)=>setPlanning((current)=>({...current,...patch}))}/>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white pt-3 pb-[max(4px,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900"><button className="btn" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={!taskTitle.trim()} onClick={()=>void saveTask()}>할 일 저장</button></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DraftFromNotesInsideQuickAdd({ onClose, textAreaRef }: { onClose: () => void; textAreaRef?: RefObject<HTMLTextAreaElement> }) {
  const createTask = useStore((s) => s.createTask);
  const refresh = useStore((s) => s.refresh);
  const calendars = useStore((s) => s.calendars);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const defaultCalendarId = (() => {
    const first = calendars.find((c) => c.enabled && !c.readOnly);
    return first?.id || 'local';
  })();

  const analyze = async () => {
    if (!notes.trim()) { setError(t("Paste some notes to analyze.")); return; }
    const hasKey = (() => { try { return !!localStorage.getItem(LS_AI_KEY); } catch { return false; } })();
    if (!hasKey) { toast(t("Add your Gemini API key in Settings")); setError(t("Missing AI key")); return; }
    setLoading(true);
    setError(null);
    try {
      const apiKey = (() => { try { return localStorage.getItem(LS_AI_KEY) || ''; } catch { return ''; } })();
      const model = (() => { try { return localStorage.getItem(LS_AI_MODEL) || DEFAULT_MODEL_ID; } catch { return DEFAULT_MODEL_ID; } })();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const now = new Date().toISOString();
      const sys = DRAFT_SYSTEM_PROMPT;
      const user = `now: ${now}\ntimezone: ${tz}\nnotes:\n${notes}`;
      const resp = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, apiKey, messages: [
          { role: 'system', content: sys }, { role: 'user', content: user },
        ] }),
      });
      const data = await resp.json();
      if (!data?.ok) throw new Error(data?.error || t("AI request failed"));
      const parsed = looseParseJSON(String(data.content || ''));
      const next = normalizeDraftItems(parsed);
      setItems(next);
      if (!next.length) setError('No tasks or events were identified.');
    } catch (e) { setError((e as Error).message || t("Failed to analyze notes")); }
    finally { setLoading(false); }
  };

  const confirmCreate = async () => {
    const selected = items.filter((i) => i.title.trim());
    if (!selected.length) { toast(t("Nothing to create.")); return; }
    try {
      for (const it of selected) {
        const startEnd = normalizeStartEnd(it.start, it.end, !!it.allDay);
        await createTask({
          title: it.title.trim(),
          description: it.description?.trim() || undefined,
          stage: 'todo', checked: false,
          start: startEnd.start, end: startEnd.end, allDay: startEnd.allDay,
          isEvent: !!it.isEvent, hiddenOnCalendar: false,
          linkedTo: undefined, parentId: null,
          subTasks: (it.subTasks || []).map((s) => ({ id: s.id, title: s.title, done: !!s.done })),
          calendarId: defaultCalendarId,
        } as any);
      }
      toast(interpolate('createdCount', { count: selected.length }));
      await (refresh as any)();
      onClose();
    } catch (e) { toast((e as Error).message || t("Failed to create tasks")); }
  };

  return (
    <div className="space-y-3" onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (loading) return;
        if (items.length > 0) void confirmCreate();
        else void analyze();
      }
    }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <ListPlus className="w-4 h-4 text-blue-600" />
          <span className="font-medium">{t("Bulk Add")}</span>
          <span className="text-gray-500 dark:text-gray-400">{t("Paste items or notes")}</span>
        </div>
        <div className="text-xs text-gray-500">{t("Cmd/Ctrl+Enter to preview or create")}</div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <textarea
          ref={textAreaRef}
          className="w-full h-48 resize-y px-4 py-3 rounded-2xl bg-transparent border-0 outline-none ring-0 shadow-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-slate-600"
          placeholder={"E.g.\n– Kickoff Monday 10–11am\n– Ship homepage by Friday; subtasks: hero copy, screenshots, QA\n– Follow up with Alice next week"}
          value={notes}
          onChange={(e)=>setNotes(e.target.value)}
        />
      </div>
          <div className="flex items-center justify-between">
            <NotesAIAccessHint />
            <button className="btn inline-flex items-center gap-2" onClick={analyze} disabled={loading}>
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin"/><span>{t("Analyzing…")}</span></>) : (<><Wand2 className="w-4 h-4"/><span>{t("Preview")}</span></>)}
            </button>
          </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {items.length > 0 && (
        <div className="space-y-3 max-h-[50vh] overflow-auto pr-1">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 px-1">
            <span>{interpolate('draftCount', { count: items.length })}</span>
          </div>
          {items.map((it, idx) => (
            <DraftPreviewItem
              key={it.id}
              item={it}
              setItem={(next)=>setItems(arr=>arr.map(x=>x.id===it.id?next:x))}
              index={idx+1}
              onRemove={() => setItems(arr => arr.filter(x => x.id !== it.id))}
            />
          ))}
          <div className="sticky bottom-0 pt-2">
            <div className="flex items-center justify-end rounded-xl px-3 py-2 bg-white dark:bg-slate-900">
              <button className="btn" onClick={confirmCreate}>{interpolate('createCount', { count: items.length })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
type UID = string;
type DraftItem = { id: UID; include: boolean; title: string; description?: string; isEvent: boolean; start?: string; end?: string; allDay?: boolean; subTasks?: { id: UID; title: string; done: boolean }[] };

function DraftPreviewItem({ item, setItem, index, onRemove }: { item: DraftItem; setItem: (i: DraftItem) => void; index: number; onRemove?: () => void }) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(220, Math.max(64, el.scrollHeight)) + 'px'; }, [item.description]);
  return (
    <div className="p-3 rounded-2xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-6 rounded-full ${item.isEvent ? 'bg-blue-500' : 'bg-emerald-500'}`} aria-hidden />
          <input className="input h-12 text-[16px] font-medium" placeholder={item.isEvent ? t("Event title") : t("Task title")} value={item.title} onChange={(e)=>setItem({ ...item, title: e.target.value })} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1"><input type="checkbox" className="checkbox-circle" checked={item.isEvent} onChange={(e)=>setItem({ ...item, isEvent: e.target.checked })} /><span className="px-2 py-0.5 rounded-full border border-gray-300 dark:border-slate-600">{t("Event")}</span></label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" className="checkbox-circle" checked={!!item.allDay} onChange={(e)=>setItem(adjustAllDay(item, e.target.checked))} /><span className="px-2 py-0.5 rounded-full border border-gray-300 dark:border-slate-600">{t("All‑day")}</span></label>
          {onRemove && (
            <button className="btn border-transparent h-9 w-9 p-0 inline-flex items-center justify-center" aria-label={t("Remove item")} title={t("Remove item")} onClick={onRemove}>
              <Trash2 className="w-4 h-4"/>
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300">{item.allDay ? t("Date") : t("Start")}</label>
          {item.allDay ? (
            <DateTimePicker className="mt-1" dateOnly value={item.start} onChange={(iso)=> setItem(normalizeAllDayRange({ ...item, start: iso }))} />
          ) : (
            <DateTimePicker className="mt-1" value={item.start} onChange={(iso)=> setItem({ ...item, start: iso })} />
          )}
        </div>
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-300">{item.allDay ? t("End Date") : t("End")}</label>
          {item.allDay ? (
            <DateTimePicker className="mt-1" dateOnly value={item.end} onChange={(iso)=> setItem(normalizeAllDayRange({ ...item, end: iso }))} />
          ) : (
            <DateTimePicker className="mt-1" value={item.end} onChange={(iso)=> setItem({ ...item, end: iso })} />
          )}
        </div>
      </div>
      <div className="mt-3">
        <label className="text-sm text-gray-600 dark:text-gray-300">{t("Description")}</label>
        <textarea ref={taRef} className="mt-1 resize-none w-full px-3 py-2 rounded-2xl bg-transparent border-0 outline-none ring-0 shadow-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-slate-600" rows={3} placeholder={t("Add details…")} value={item.description || ''} onChange={(e)=>setItem({ ...item, description: e.target.value })} />
      </div>
      <DraftSubtasks item={item} setItem={setItem} />
    </div>
  );
}

function DraftSubtasks({ item, setItem }: { item: DraftItem; setItem: (i: DraftItem) => void }) {
  const add = () => setItem({ ...item, subTasks: [...(item.subTasks || []), { id: crypto.randomUUID(), title: '', done: false }] });
  const update = (id: UID, patch: Partial<{ title: string; done: boolean }>) => setItem({ ...item, subTasks: (item.subTasks || []).map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const remove = (id: UID) => setItem({ ...item, subTasks: (item.subTasks || []).filter((s) => s.id !== id) });
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">{t("Subtasks")}</div>
        <button className="btn border-transparent h-9 w-9 p-0 inline-flex items-center justify-center" aria-label={t("Add subtask")} title={t("Add subtask")} onClick={add}><Plus className="w-4 h-4"/></button>
      </div>
      <div className="space-y-2 mt-2">
        {(item.subTasks || []).map((st) => (
          <div key={st.id} className="flex items-center gap-2">
            <input type="checkbox" className="checkbox-circle checkbox-xl" checked={st.done} onChange={(e)=>update(st.id, { done: e.target.checked })} />
            <input className="h-9 flex-1 px-3 rounded-xl bg-transparent border-0 outline-none appearance-none ring-0 shadow-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-slate-600" value={st.title} onChange={(e)=>update(st.id, { title: e.target.value })} />
            <button className="btn border-transparent h-9 w-9 p-0 inline-flex items-center justify-center" aria-label={t("Delete subtask")} title={t("Delete subtask")} onClick={()=>remove(st.id)}><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
        {(item.subTasks || []).length === 0 && <div className="text-xs text-gray-500">{t("No subtasks.")}</div>}
      </div>
    </div>
  );
}

function NotesAIAccessHint() {
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => { try { setHasKey(!!localStorage.getItem(LS_AI_KEY)); } catch { setHasKey(false); } }, []);
  return hasKey ? null : (<div className="text-xs text-gray-500">{t("Add a Gemini API key in Settings.")}</div>);
}

// Shared helpers
function toLocalDT(iso?: string): string { if (!iso) return ''; const d = new Date(iso); if (isNaN(d.getTime())) return ''; const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocalDT(s: string): string | undefined { if (!s) return undefined; const d = new Date(s); return isNaN(d.getTime()) ? undefined : d.toISOString(); }
function toLocalDate(iso?: string): string { if (!iso) return ''; const d = new Date(iso); if (isNaN(d.getTime())) return ''; const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromLocalDate(s: string): string | undefined { if (!s) return undefined; const [y,m,d] = s.split('-').map((x)=>parseInt(x,10)); if (!y||!m||!d) return undefined; const dt = new Date(y, m-1, d, 0, 0, 0, 0); return dt.toISOString(); }
function setAllDayDate(item: DraftItem, date: string, which: 'start'|'end'): DraftItem { const next: DraftItem = { ...item }; if (which==='start') next.start = fromLocalDate(date); else next.end = fromLocalDate(date); return normalizeAllDayRange(next); }
function adjustAllDay(item: DraftItem, allDay: boolean): DraftItem { const next: DraftItem = { ...item, allDay }; if (allDay) return normalizeAllDayRange(next); return next; }
function normalizeAllDayRange(item: DraftItem): DraftItem { if (!item.allDay) return item; const s = item.start ? new Date(item.start) : new Date(); const s0 = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0); let e0 = item.end ? new Date(item.end) : new Date(s0.getTime() + 86400000); e0 = new Date(e0.getFullYear(), e0.getMonth(), e0.getDate(), 0, 0, 0, 0); if (e0.getTime() <= s0.getTime()) e0 = new Date(s0.getTime() + 86400000); return { ...item, start: s0.toISOString(), end: e0.toISOString(), allDay: true }; }
function normalizeStartEnd(start?: string, end?: string, allDay?: boolean): { start?: string; end?: string; allDay?: boolean } { if (allDay) { const s = start ? new Date(start) : new Date(); const s0 = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0,0,0,0); let e0: Date; if (end) { const e = new Date(end); e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0,0,0,0); if (e0.getTime() <= s0.getTime()) e0 = new Date(s0.getTime() + 86400000); } else { e0 = new Date(s0.getTime() + 86400000); } return { start: s0.toISOString(), end: e0.toISOString(), allDay: true }; } if (start && !end) { const s = new Date(start); const e = new Date(s.getTime() + 3600000); return { start: s.toISOString(), end: e.toISOString(), allDay: false }; } return { start, end, allDay }; }
function looseParseJSON(s: string): any | null { try { return JSON.parse(s); } catch {} try { const i = s.indexOf('{'); const j = s.lastIndexOf('}'); if (i>=0 && j>i) return JSON.parse(s.slice(i, j+1)); } catch {} return null; }
function asString(x: any): string | undefined { return typeof x === 'string' ? x : undefined; }
function asBool(x: any): boolean | undefined { return typeof x === 'boolean' ? x : undefined; }
function toISOOrUndefined(s?: string): string | undefined { if (!s) return undefined; const d = new Date(s); return isNaN(d.getTime()) ? undefined : d.toISOString(); }
function normalizeDraftItems(parsed: any): DraftItem[] {
  const arr: any[] = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  const out: DraftItem[] = [];
  for (const it of arr) {
    const title = asString(it?.title)?.trim();
    if (!title) continue;
    const type = String(it?.type || (it?.isEvent ? 'event' : 'task')).toLowerCase();
    const isEvent = type === 'event';
    const allDay = asBool(it?.allDay) ?? undefined;
    const start = asString(it?.start) || asString(it?.when) || asString(it?.startTime) || asString(it?.due);
    const end = asString(it?.end) || asString(it?.endTime) || undefined;
    const desc = asString(it?.description) || asString(it?.notes) || undefined;
    const subsRaw: any[] = Array.isArray(it?.subtasks) ? it.subtasks : [];
    const subTasks = subsRaw.map((s)=> (typeof s === 'string' ? s : (s && typeof s.title === 'string' ? s.title : ''))).map((s)=>String(s||'').trim()).filter(Boolean).slice(0, 20).map((title)=>({ id: crypto.randomUUID(), title, done: false }));
    let startISO = toISOOrUndefined(start); let endISO = toISOOrUndefined(end);
    if (allDay) { const norm = normalizeStartEnd(startISO, endISO, true); startISO = norm.start; endISO = norm.end; }
    out.push({ id: crypto.randomUUID(), include: true, title, description: desc, isEvent, start: startISO, end: endISO, allDay, subTasks });
  }
  return out;
}

const DRAFT_SYSTEM_PROMPT = `You are a planner assistant. Extract actionable items from freeform notes.
Return ONLY JSON with this schema:
{ "items": [ { "type": "task" | "event", "title": string, "description"?: string, "start"?: ISO 8601 datetime, "end"?: ISO 8601 datetime, "allDay"?: boolean, "subtasks"?: string[] } ] }
Guidelines:
- Parse dates/times in the provided timezone and include ISO datetimes.
- Use type "event" for meetings or time blocks; type "task" for to-dos.
- If a task has only a due date, set "start" to that date (00:00) and "allDay": true. No need for "end".
- Keep titles concise. Prefer 3–7 words.
- Subtasks should be short, concrete actions.
- If nothing is actionable, return {"items": []}.`;
