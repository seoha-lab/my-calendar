'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '@/store';
import {
  buildShiftPattern,
  getShiftInterval,
  materializeShiftChanges,
  resolveShiftTypeId,
  stageShiftChange,
  toLocalDateKey,
  type ShiftAssignmentInput,
  type ShiftManagerMode,
  type StagedShiftChanges,
} from '@/lib/shifts';
import { toast } from '@/lib/toast';
import { findConflicts, getTaskBusyIntervals } from '@/lib/scheduling';

type Mode = ShiftManagerMode;

function firstOfMonth(dateKey: string) {
  return dateKey.slice(0, 7) + '-01';
}

function monthLabel(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월`;
}

function moveMonth(dateKey: string, amount: number) {
  const [year, month] = dateKey.split('-').map(Number);
  return toLocalDateKey(new Date(year, month - 1 + amount, 1));
}

function buildMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(year, month - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => toLocalDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)));
}

function isSameMonth(dateKey: string, monthKey: string) {
  return dateKey.slice(0, 7) === monthKey.slice(0, 7);
}

function dayNumber(dateKey: string) {
  return Number(dateKey.slice(8, 10));
}

function isSunday(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() === 0;
}

export default function ShiftManagerModal() {
  const shiftTypes = useStore((state) => state.shiftTypes);
  const assignments = useStore((state) => state.shiftAssignments);
  const tasks = useStore((state) => state.tasks);
  const refreshShifts = useStore((state) => state.refreshShifts);
  const setShiftAssignment = useStore((state) => state.setShiftAssignment);
  const applyShiftAssignmentChanges = useStore((state) => state.applyShiftAssignmentChanges);
  const deleteShiftAssignment = useStore((state) => state.deleteShiftAssignment);

  const todayKey = toLocalDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('single');
  const [date, setDate] = useState(todayKey);
  const [month, setMonth] = useState(firstOfMonth(todayKey));
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [pattern, setPattern] = useState<string[]>([]);
  const [repetitions, setRepetitions] = useState(3);
  const [preview, setPreview] = useState<ShiftAssignmentInput[]>([]);
  const [staged, setStaged] = useState<StagedShiftChanges>({});
  const [saving, setSaving] = useState(false);
  const [confirmedConflicts, setConfirmedConflicts] = useState(false);

  const enabledTypes = useMemo(() => shiftTypes.filter((type) => type.enabled), [shiftTypes]);
  const enabledWorkTypes = useMemo(() => enabledTypes.filter((type) => !type.isOff), [enabledTypes]);
  const typesById = useMemo(() => new Map(shiftTypes.map((type) => [type.id, type])), [shiftTypes]);
  const taskBusy = useMemo(() => getTaskBusyIntervals(Object.values(tasks)), [tasks]);
  const monthDays = useMemo(() => buildMonthGrid(month), [month]);

  const monthlyChanges = useMemo(() => materializeShiftChanges(staged, assignments), [staged, assignments]);
  const monthlyConflicts = useMemo(() => {
    return monthlyChanges.upserts.flatMap((input) => {
      const type = typesById.get(input.shiftTypeId);
      const interval = type ? getShiftInterval(input.date, type) : null;
      if (!interval) return [];
      return findConflicts(interval, taskBusy).conflicts.map((conflict) => ({ date: input.date, code: type!.code, title: conflict.title }));
    });
  }, [monthlyChanges, taskBusy, typesById]);

  const singleConflicts = useMemo(() => {
    const type = typesById.get(selectedTypeId);
    if (!type) return [];
    const interval = getShiftInterval(date, type);
    return interval ? findConflicts(interval, taskBusy).conflicts : [];
  }, [date, selectedTypeId, taskBusy, typesById]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string; mode?: Mode }>).detail || {};
      const nextDate = detail.date || toLocalDateKey(new Date());
      setDate(nextDate);
      setMonth(firstOfMonth(nextDate));
      setMode(detail.mode || 'single');
      setPattern([]);
      setPreview([]);
      setStaged({});
      setConfirmedConflicts(false);
      setSelectedTypeId(assignments[nextDate]?.shiftTypeId ?? enabledTypes[0]?.id ?? '');
      setOpen(true);
      void refreshShifts();
    };
    window.addEventListener('open-shift-manager', handler as EventListener);
    return () => window.removeEventListener('open-shift-manager', handler as EventListener);
  }, [assignments, enabledTypes, refreshShifts]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    setConfirmedConflicts(false);
  }, [date, selectedTypeId, staged]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setStaged({});
    setPreview([]);
  };

  const chooseMonthShift = (shiftTypeId: string | null) => {
    const result = stageShiftChange(staged, date, shiftTypeId);
    setStaged(result.changes);
    setDate(result.nextDate);
    if (result.nextDate.slice(0, 7) !== month.slice(0, 7)) setMonth(firstOfMonth(result.nextDate));
  };

  const saveMonth = async () => {
    if (monthlyConflicts.length && !confirmedConflicts) return;
    setSaving(true);
    try {
      await applyShiftAssignmentChanges(monthlyChanges.upserts, monthlyChanges.deleteDates);
      toast(`근무 ${monthlyChanges.upserts.length + monthlyChanges.deleteDates.length}일을 저장했습니다.`);
      close();
    } catch (error) {
      toast(error instanceof Error ? error.message : '근무를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveSingle = async () => {
    if (!selectedTypeId) return;
    if (singleConflicts.length && !confirmedConflicts) return;
    setSaving(true);
    try {
      const type = typesById.get(selectedTypeId);
      if (type?.isOff) await deleteShiftAssignment(date);
      else await setShiftAssignment({ date, shiftTypeId: selectedTypeId });
      toast(type?.isOff ? '해당 날짜의 근무를 비웠습니다.' : '근무를 저장했습니다.');
      close();
    } catch (error) {
      toast(error instanceof Error ? error.message : '근무를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const buildPreview = () => {
    if (!pattern.length) return;
    setPreview(buildShiftPattern(date, pattern, repetitions));
    setConfirmedConflicts(false);
  };

  const patternConflicts = preview.flatMap((input) => {
    const type = typesById.get(input.shiftTypeId);
    const interval = type ? getShiftInterval(input.date, type) : null;
    if (!interval) return [];
    return findConflicts(interval, taskBusy).conflicts.map((conflict) => ({ date: input.date, code: type!.code, title: conflict.title }));
  });

  const savePattern = async () => {
    if (!preview.length) return;
    if (patternConflicts.length && !confirmedConflicts) return;
    setSaving(true);
    try {
      const offDates = preview.filter((input) => typesById.get(input.shiftTypeId)?.isOff).map((input) => input.date);
      const work = preview.filter((input) => !typesById.get(input.shiftTypeId)?.isOff);
      await applyShiftAssignmentChanges(work, offDates);
      toast(`근무 패턴 ${preview.length}일을 저장했습니다.`);
      close();
    } catch (error) {
      toast(error instanceof Error ? error.message : '근무 패턴을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="근무 입력" onClick={close}>
      <div className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-950 sm:h-[min(900px,calc(100dvh-2rem))] sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">근무 입력</h2>
            <p className="text-xs text-gray-500">월간 달력을 보면서 근무를 연속으로 입력할 수 있습니다.</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={close} aria-label="닫기"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-gray-100 px-4 py-2 dark:border-slate-800 sm:px-5">
          {([['month','한달 입력'],['single','하루 입력'],['pattern','패턴 입력']] as const).map(([value,label]) => (
            <button key={value} type="button" className={`rounded-full px-3 py-2 text-sm font-medium ${mode === value ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800'}`} onClick={() => { setMode(value); setPreview([]); setConfirmedConflicts(false); }}>{label}</button>
          ))}
        </div>

        {mode === 'month' && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" className="btn btn-icon" onClick={() => { const next = moveMonth(month, -1); setMonth(next); setDate(next); }} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className="rounded-xl px-3 py-1.5 text-xl font-semibold tracking-tight" onClick={() => { setMonth(firstOfMonth(todayKey)); setDate(todayKey); }}>{monthLabel(month)}</button>
                <button type="button" className="btn btn-icon" onClick={() => { const next = moveMonth(month, 1); setMonth(next); setDate(next); }} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-7 border-x border-t border-gray-200 text-center text-xs font-medium text-gray-500 dark:border-slate-800">
                {['일','월','화','수','목','금','토'].map((weekday, index) => <div key={weekday} className={`border-b border-r border-gray-200 py-2 last:border-r-0 dark:border-slate-800 ${index === 0 ? 'text-red-500' : ''}`}>{weekday}</div>)}
              </div>
              <div className="grid grid-cols-7 border-l border-gray-200 dark:border-slate-800">
                {monthDays.map((day) => {
                  const typeId = resolveShiftTypeId(day, assignments, staged);
                  const type = typeId ? typesById.get(typeId) : undefined;
                  const selected = day === date;
                  const today = day === todayKey;
                  const inMonth = isSameMonth(day, month);
                  const changed = Object.prototype.hasOwnProperty.call(staged, day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => setDate(day)}
                      className={`relative min-h-[76px] border-b border-r border-gray-200 p-1.5 text-left transition sm:min-h-[94px] dark:border-slate-800 ${inMonth ? 'bg-white dark:bg-slate-950' : 'bg-gray-50/70 text-gray-300 dark:bg-slate-900/40 dark:text-slate-600'} ${selected ? 'z-10 ring-2 ring-inset ring-blue-500' : ''}`}
                      aria-label={`${day}${type ? `, ${type.code}` : ', 근무 없음'}`}
                    >
                      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold ${today ? 'bg-blue-600 text-white' : isSunday(day) ? 'text-red-500' : ''}`}>{dayNumber(day)}</span>
                      {type && !type.isOff && <span className="mt-1 block truncate rounded-md border-l-4 border-rose-300 bg-rose-50 px-1.5 py-1 text-center text-xs font-semibold text-slate-800 dark:border-rose-400/70 dark:bg-rose-950/30 dark:text-rose-100">{type.code}</span>}
                      {changed && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" aria-label="수정됨" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-slate-900 dark:text-gray-300">
                선택: <strong className="text-slate-950 dark:text-white">{date}</strong> · 근무 버튼을 누르면 자동으로 다음 날짜로 이동합니다.
              </div>

              {monthlyConflicts.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><strong>일정과 겹치는 근무 {monthlyConflicts.length}건</strong><p className="mt-1 text-xs">{monthlyConflicts.slice(0, 4).map((item) => `${item.date} ${item.code} ↔ ${item.title}`).join(' · ')}</p></div></div>
                  <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={confirmedConflicts} onChange={(e) => setConfirmedConflicts(e.target.checked)} />겹침을 확인했고 그대로 저장합니다.</label>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {enabledWorkTypes.map((type) => (
                  <button key={type.id} type="button" className="min-h-12 min-w-[64px] shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-white" onClick={() => chooseMonthShift(type.id)}>
                    <span className="block">{type.code}</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-gray-500">{type.startTime}</span>
                  </button>
                ))}
                <button type="button" className="min-h-12 min-w-[72px] shrink-0 rounded-xl border border-gray-300 bg-gray-100 px-3 text-sm font-semibold text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200" onClick={() => chooseMonthShift(null)}>
                  OFF
                  <span className="mt-0.5 block text-[10px] font-normal text-gray-500">비우기</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-gray-500">변경 {Object.keys(staged).length}일</span>
                <div className="flex gap-2">
                  <button type="button" className="btn min-h-11" onClick={close}>취소</button>
                  <button type="button" className="btn btn-primary min-h-11 px-5" disabled={saving || (monthlyConflicts.length > 0 && !confirmedConflicts)} onClick={() => void saveMonth()}>{saving ? '저장 중…' : '저장'}</button>
                </div>
              </div>
            </div>
          </>
        )}

        {mode === 'single' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <label className="block text-sm font-medium">날짜<input className="input mt-1" type="date" value={date} onChange={(e) => { setDate(e.target.value); setMonth(firstOfMonth(e.target.value)); setSelectedTypeId(assignments[e.target.value]?.shiftTypeId ?? selectedTypeId); }} /></label>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {enabledTypes.map((type) => <button key={type.id} type="button" onClick={() => setSelectedTypeId(type.id)} className={`rounded-xl border p-3 text-left ${selectedTypeId === type.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/30' : 'border-gray-200 dark:border-slate-700'}`}><strong>{type.code}</strong><span className="ml-2 text-sm text-gray-500">{type.name}</span><span className="mt-1 block text-xs text-gray-500">{type.isOff ? '근무 없음' : `${type.startTime}–${type.crossesMidnight ? '익일 ' : ''}${type.endTime}`}</span></button>)}
              </div>
              {singleConflicts.length > 0 && <ConflictConfirm count={singleConflicts.length} confirmed={confirmedConflicts} setConfirmed={setConfirmedConflicts} />}
              {assignments[date] && <button type="button" className="btn mt-4 min-h-10 text-red-600" onClick={() => void deleteShiftAssignment(date).then(() => { toast('근무를 삭제했습니다.'); close(); })}><Trash2 className="h-4 w-4" />이 날짜 근무 삭제</button>}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 p-4 pb-[max(16px,env(safe-area-inset-bottom))] dark:border-slate-800"><button className="btn" onClick={close}>취소</button><button className="btn btn-primary" disabled={!selectedTypeId || saving || (singleConflicts.length > 0 && !confirmedConflicts)} onClick={() => void saveSingle()}>{saving ? '저장 중…' : '근무 저장'}</button></div>
          </div>
        )}

        {mode === 'pattern' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">시작 날짜<input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label className="text-sm font-medium">반복 횟수<input className="input mt-1" type="number" min={1} max={31} value={repetitions} onChange={(e) => setRepetitions(Math.max(1, Number(e.target.value) || 1))} /></label>
              </div>
              <p className="mt-4 text-sm font-medium">패턴 순서</p>
              <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-xl border border-gray-200 p-2 dark:border-slate-700">
                {pattern.length ? pattern.map((id, index) => { const type = typesById.get(id); return <button type="button" key={`${id}-${index}`} className="rounded-lg bg-gray-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={() => setPattern(pattern.filter((_, i) => i !== index))}>{type?.code ?? '?'} <X className="ml-1 inline h-3 w-3" /></button>; }) : <span className="self-center text-sm text-gray-400">아래 근무를 눌러 D → N → OFF처럼 패턴을 만드세요.</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{enabledTypes.map((type) => <button key={type.id} type="button" className="btn min-h-10" onClick={() => { setPattern([...pattern, type.id]); setPreview([]); }}><Plus className="h-3.5 w-3.5" />{type.code}</button>)}</div>
              <button type="button" className="btn btn-primary mt-4 min-h-11" disabled={!pattern.length} onClick={buildPreview}>미리보기</button>
              {preview.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{preview.map((item) => <div key={item.date} className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-slate-900"><span className="block text-xs text-gray-500">{item.date}</span><strong>{typesById.get(item.shiftTypeId)?.code}</strong></div>)}</div>}
              {patternConflicts.length > 0 && <ConflictConfirm count={patternConflicts.length} confirmed={confirmedConflicts} setConfirmed={setConfirmedConflicts} />}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 p-4 pb-[max(16px,env(safe-area-inset-bottom))] dark:border-slate-800"><button className="btn" onClick={close}>취소</button><button className="btn btn-primary" disabled={!preview.length || saving || (patternConflicts.length > 0 && !confirmedConflicts)} onClick={() => void savePattern()}>{saving ? '저장 중…' : '패턴 저장'}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictConfirm({ count, confirmed, setConfirmed }: { count: number; confirmed: boolean; setConfirmed: (value: boolean) => void }) {
  return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />기존 일정과 겹치는 시간이 {count}건 있습니다.</div><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />확인했고 그대로 저장합니다.</label></div>;
}
