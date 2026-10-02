'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '@/store';
import { buildShiftPattern, toLocalDateKey } from '@/lib/shifts';
import type { ShiftAssignmentInput } from '@/lib/shifts';
import { toast } from '@/lib/toast';

type Mode = 'single' | 'pattern';

export default function ShiftManagerModal() {
  const shiftTypes = useStore((state) => state.shiftTypes);
  const assignments = useStore((state) => state.shiftAssignments);
  const refreshShifts = useStore((state) => state.refreshShifts);
  const setShiftAssignment = useStore((state) => state.setShiftAssignment);
  const setShiftAssignments = useStore((state) => state.setShiftAssignments);
  const deleteShiftAssignment = useStore((state) => state.deleteShiftAssignment);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('single');
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [pattern, setPattern] = useState<string[]>([]);
  const [repetitions, setRepetitions] = useState(3);
  const [preview, setPreview] = useState<ShiftAssignmentInput[]>([]);
  const [saving, setSaving] = useState(false);

  const enabledTypes = useMemo(() => shiftTypes.filter((type) => type.enabled), [shiftTypes]);
  const typesById = useMemo(() => new Map(shiftTypes.map((type) => [type.id, type])), [shiftTypes]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string; mode?: Mode }>).detail;
      setDate(detail?.date || toLocalDateKey(new Date()));
      setMode(detail?.mode || 'single');
      setPreview([]);
      setOpen(true);
      void refreshShifts();
    };
    window.addEventListener('open-shift-manager', onOpen as EventListener);
    return () => window.removeEventListener('open-shift-manager', onOpen as EventListener);
  }, [refreshShifts]);

  useEffect(() => {
    if (!open) return;
    setSelectedTypeId(assignments[date]?.shiftTypeId || '');
  }, [assignments, date, open]);

  useEffect(() => {
    if (!open || pattern.length > 0 || enabledTypes.length === 0) return;
    const byCode = new Map(enabledTypes.map((type) => [type.code, type.id]));
    setPattern(['D7', 'N7', 'N7', 'OFF'].map((code) => byCode.get(code)).filter((id): id is string => !!id));
  }, [enabledTypes, open, pattern.length]);

  const overwriteCount = preview.filter((item) => {
    const existing = assignments[item.date];
    return !!existing && existing.shiftTypeId !== item.shiftTypeId;
  }).length;

  const saveSingle = async () => {
    setSaving(true);
    try {
      if (selectedTypeId) await setShiftAssignment({ date, shiftTypeId: selectedTypeId });
      else await deleteShiftAssignment(date);
      toast(selectedTypeId ? '근무를 저장했습니다.' : '근무 정보를 삭제했습니다.');
      setOpen(false);
    } catch (error) {
      toast(`근무 저장 실패: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const makePreview = () => {
    try {
      setPreview(buildShiftPattern(date, pattern, repetitions));
    } catch (error) {
      toast((error as Error).message);
    }
  };

  const applyPattern = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    try {
      await setShiftAssignments(preview);
      toast(`근무 ${preview.length}개를 저장했습니다.`);
      setOpen(false);
    } catch (error) {
      toast(`근무 패턴 저장 실패: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const movePattern = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pattern.length) return;
    setPattern((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPreview([]);
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="shift-manager-title" className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60 flex items-center justify-center p-3 sm:p-6" onMouseDown={() => setOpen(false)}>
      <div className="card w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="shift-manager-title" className="text-lg font-semibold">교대근무 입력</h2>
            <p className="text-sm text-gray-500">근무 시작일을 기준으로 저장합니다.</p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={() => setOpen(false)} aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-slate-800">
          <button className={`min-h-10 rounded-lg text-sm font-medium ${mode === 'single' ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => { setMode('single'); setPreview([]); }}>날짜별 입력</button>
          <button className={`min-h-10 rounded-lg text-sm font-medium ${mode === 'pattern' ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`} onClick={() => { setMode('pattern'); setPreview([]); }}>패턴 일괄 입력</button>
        </div>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm font-medium">{mode === 'single' ? '날짜' : '시작일'}</span>
          <input className="input min-h-11" type="date" value={date} onChange={(event) => { setDate(event.target.value); setPreview([]); }} />
        </label>

        {mode === 'single' ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium">근무 선택</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {enabledTypes.map((type) => (
                <button key={type.id} className={`min-h-14 rounded-xl border px-3 py-2 text-left ${selectedTypeId === type.id ? 'border-[var(--category-accent)] bg-[var(--category-bg)] category-hospital' : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`} onClick={() => setSelectedTypeId(type.id)}>
                  <span className="block font-semibold">{type.code}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-300">{type.name}</span>
                </button>
              ))}
              <button className={`min-h-14 rounded-xl border px-3 py-2 text-left ${selectedTypeId === '' ? 'border-slate-500 bg-slate-50 dark:bg-slate-800' : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`} onClick={() => setSelectedTypeId('')}>
                <span className="block font-semibold">근무 없음</span>
                <span className="block text-xs text-gray-500 dark:text-gray-300">assignment 삭제</span>
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn" onClick={() => setOpen(false)}>취소</button>
              <button className="btn btn-primary min-h-11" disabled={saving} onClick={saveSingle}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">패턴</p>
                <div className="flex flex-wrap gap-1">
                  {enabledTypes.map((type) => <button key={type.id} className="btn min-h-10 px-3" onClick={() => { setPattern((current) => [...current, type.id]); setPreview([]); }}><Plus className="w-3.5 h-3.5" />{type.code}</button>)}
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {pattern.map((typeId, index) => {
                  const type = typesById.get(typeId);
                  return (
                    <div key={`${typeId}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="font-medium">{index + 1}. {type?.code} <span className="text-sm font-normal text-gray-500">{type?.name}</span></span>
                      <div className="flex gap-1">
                        <button className="btn btn-icon btn-ghost" onClick={() => movePattern(index, -1)} disabled={index === 0} aria-label="앞으로 이동"><ChevronUp className="w-4 h-4" /></button>
                        <button className="btn btn-icon btn-ghost" onClick={() => movePattern(index, 1)} disabled={index === pattern.length - 1} aria-label="뒤로 이동"><ChevronDown className="w-4 h-4" /></button>
                        <button className="btn btn-icon btn-ghost" onClick={() => { setPattern((current) => current.filter((_, itemIndex) => itemIndex !== index)); setPreview([]); }} aria-label="패턴에서 삭제"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
                {pattern.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">위 버튼으로 근무 유형을 추가하세요.</p>}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">반복 횟수</span>
              <input className="input min-h-11" type="number" min={1} max={52} value={repetitions} onChange={(event) => { setRepetitions(Math.max(1, Math.min(52, Number(event.target.value) || 1))); setPreview([]); }} />
            </label>

            <button className="btn w-full min-h-11" disabled={pattern.length === 0} onClick={makePreview}>적용 일정 미리보기</button>

            {preview.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">총 {preview.length}일</p>
                  {overwriteCount > 0 && <p className="text-sm font-medium text-amber-700 dark:text-amber-300">기존 근무 {overwriteCount}개를 변경합니다.</p>}
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                  {preview.map((item) => <div key={item.date} className="flex items-center justify-between py-2 text-sm"><span>{item.date}</span><span className="font-semibold">{typesById.get(item.shiftTypeId)?.code}</span></div>)}
                </div>
                <p className="mt-3 text-xs text-gray-500">아래 적용 버튼을 누르면 위 Preview대로 저장됩니다.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setOpen(false)}>취소</button>
              <button className="btn btn-primary min-h-11" disabled={saving || preview.length === 0} onClick={applyPattern}>{saving ? '저장 중…' : '패턴 적용'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
