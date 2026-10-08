'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '@/store';
import { openShiftManager } from '@/lib/shifts/ui';
import type { ShiftType } from '@/types';
import type { ShiftTypeInput } from '@/lib/shifts';
import { toast } from '@/lib/toast';

type Draft = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
};

const EMPTY_DRAFT: Draft = { code: '', name: '', startTime: '09:00', endTime: '18:00', crossesMidnight: false };

function timeLabel(type: ShiftType) {
  if (type.isOff) return '근무시간 없음';
  return `${type.startTime}–${type.crossesMidnight ? '익일 ' : ''}${type.endTime}`;
}

export default function ShiftSettings() {
  const shiftTypes = useStore((state) => state.shiftTypes);
  const refreshShifts = useStore((state) => state.refreshShifts);
  const createShiftType = useStore((state) => state.createShiftType);
  const updateShiftType = useStore((state) => state.updateShiftType);
  const deleteShiftType = useStore((state) => state.deleteShiftType);
  const assignments = useStore((state) => state.shiftAssignments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void refreshShifts(); }, [refreshShifts]);

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of Object.values(assignments)) counts.set(item.shiftTypeId, (counts.get(item.shiftTypeId) ?? 0) + 1);
    return counts;
  }, [assignments]);

  const beginEdit = (type: ShiftType) => {
    if (type.isOff) return;
    setAdding(false);
    setEditingId(type.id);
    setDraft({
      code: type.code,
      name: type.name,
      startTime: type.startTime ?? '09:00',
      endTime: type.endTime ?? '18:00',
      crossesMidnight: type.crossesMidnight,
    });
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const saveDraft = async () => {
    const code = draft.code.trim().toUpperCase();
    const name = draft.name.trim();
    if (!code || !name) {
      toast('근무 코드와 이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const input: ShiftTypeInput = {
        code,
        name,
        startTime: draft.startTime,
        endTime: draft.endTime,
        crossesMidnight: draft.crossesMidnight,
        isOff: false,
        enabled: true,
      };
      if (editingId) {
        await updateShiftType(editingId, input);
        toast('근무 유형을 수정했습니다.');
      } else {
        await createShiftType(input);
        toast('근무 유형을 추가했습니다.');
      }
      cancelEdit();
    } catch (error) {
      toast(error instanceof Error ? error.message : '근무 유형을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-4 space-y-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium flex items-center gap-2"><CalendarClock className="w-4 h-4 text-gray-500" /> 근무 설정</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">기본 D/E/N/D2와 병원별 사용자 정의 근무를 함께 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn min-h-11" onClick={() => { setEditingId(null); setAdding(true); setDraft(EMPTY_DRAFT); }}><Plus className="h-4 w-4" />근무 유형 추가</button>
          <button className="btn btn-primary min-h-11" onClick={() => openShiftManager(undefined, 'month')}>한달 근무 입력</button>
        </div>
      </div>

      {(adding || editingId) && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-sm"><span className="mb-1 block text-gray-600 dark:text-gray-300">코드</span><input className="input" value={draft.code} maxLength={8} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="예: M" /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-600 dark:text-gray-300">근무명</span><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="예: 미들" /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-600 dark:text-gray-300">시작</span><input className="input" type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-600 dark:text-gray-300">종료</span><input className="input" type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" checked={draft.crossesMidnight} onChange={(e) => setDraft({ ...draft, crossesMidnight: e.target.checked })} /><span>익일 종료</span></label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn min-h-10" onClick={cancelEdit}><X className="h-4 w-4" />취소</button>
            <button type="button" className="btn btn-primary min-h-10" disabled={saving} onClick={() => void saveDraft()}><Check className="h-4 w-4" />{saving ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shiftTypes.map((type) => {
          const isCore = type.id.startsWith('shift-');
          const used = assignmentCounts.get(type.id) ?? 0;
          return (
            <div key={type.id} className={`rounded-xl border p-3 ${type.enabled ? 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'border-gray-200 bg-gray-50 opacity-65 dark:border-slate-800 dark:bg-slate-900/50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-950 dark:text-white">{type.code}</span>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{type.name}</span>
                </div>
                {!type.isOff && <button type="button" className="btn btn-icon min-h-9 min-w-9" aria-label={`${type.code} 수정`} onClick={() => beginEdit(type)}><Pencil className="h-3.5 w-3.5" /></button>}
              </div>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{timeLabel(type)}</p>
              <p className="mt-1 text-xs text-gray-500">{used ? `입력된 근무 ${used}개` : '사용 기록 없음'}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={type.enabled} onChange={(e) => void updateShiftType(type.id, { enabled: e.target.checked }).catch((error) => toast(error instanceof Error ? error.message : '변경하지 못했습니다.'))} />
                  입력 버튼에 표시
                </label>
                {!isCore && <button type="button" className="btn btn-icon min-h-9 min-w-9 text-red-600" aria-label={`${type.code} 삭제`} onClick={() => void deleteShiftType(type.id).then(() => toast('근무 유형을 삭제했습니다.')).catch((error) => toast(error instanceof Error ? error.message : '삭제하지 못했습니다.'))}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">기존 D7/N7 데이터는 그대로 유지됩니다. 사용 중인 사용자 정의 근무는 삭제 대신 비활성화를 권장합니다.</p>
    </section>
  );
}
