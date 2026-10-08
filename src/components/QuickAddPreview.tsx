'use client';

import { AlertTriangle, ArrowLeft, CalendarCheck2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  buildWeeklyOccurrenceDates,
  isEndOnNextDay,
  localDateTimeToISO,
  weeklyRecurrenceLabel,
  type ParsedEvent,
  type ParsedKoreanInput,
  type ParsedShift,
} from '@/lib/nlp';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import CategorySelect from './CategorySelect';
import { findConflicts, getCombinedBusyIntervals } from '@/lib/scheduling';
import { getShiftInterval } from '@/lib/shifts';
import type { BusyInterval } from '@/types';

type Props = {
  value: ParsedKoreanInput;
  onChange: (value: ParsedKoreanInput) => void;
  onBack: () => void;
  onSaved: () => void;
};

function allDayRange(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString(), allDay: true };
}

export default function QuickAddPreview({ value, onChange, onBack, onSaved }: Props) {
  const createTask = useStore((s) => s.createTask);
  const addRanges = useStore((s) => s.addRanges);
  const setShiftAssignment = useStore((s) => s.setShiftAssignment);
  const shiftTypes = useStore((s) => s.shiftTypes);
  const tasks = useStore((s) => s.tasks);
  const shiftAssignments = useStore((s) => s.shiftAssignments);

  const [confirmedAmbiguities, setConfirmedAmbiguities] = useState(false);
  const [confirmedConflicts, setConfirmedConflicts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shiftType = useMemo(
    () => value.kind === 'shift' ? shiftTypes.find((type) => type.code === value.shiftCode) : undefined,
    [shiftTypes, value],
  );

  const occurrenceDates = useMemo(() => {
    if (value.kind !== 'event' || !value.date) return [];
    if (!value.recurrence) return [value.date];
    if (!value.recurrence.until) return [];
    return buildWeeklyOccurrenceDates(value.date, value.recurrence.until, value.recurrence.weekdays);
  }, [value]);

  const conflicts = useMemo(() => {
    try {
      const busy = getCombinedBusyIntervals(Object.values(tasks), Object.values(shiftAssignments), shiftTypes);
      if (value.kind === 'event') {
        if (!value.date) return [] as BusyInterval[];
        return occurrenceDates.flatMap((date) => {
          const range = value.allDay
            ? allDayRange(date)
            : (value.startTime && value.endTime
              ? { start: localDateTimeToISO(date, value.startTime), end: localDateTimeToISO(date, value.endTime, isEndOnNextDay(value.startTime, value.endTime)), allDay: false }
              : null);
          if (!range) return [];
          return findConflicts({ start: new Date(range.start), end: new Date(range.end) }, busy).conflicts;
        });
      }
      if (value.kind === 'shift' && value.date && shiftType) {
        const candidate = getShiftInterval(value.date, shiftType);
        if (!candidate) return [] as BusyInterval[];
        const existing = shiftAssignments[value.date];
        return findConflicts(candidate, busy, existing ? { source: 'shift', sourceId: existing.id } : undefined).conflicts;
      }
    } catch {}
    return [] as BusyInterval[];
  }, [value, occurrenceDates, shiftType, tasks, shiftAssignments, shiftTypes]);

  const conflictKey = conflicts.map((item) => item.source + ':' + item.sourceId + ':' + item.start.toISOString()).join('|');
  useEffect(() => setConfirmedConflicts(false), [conflictKey, value]);

  const recurrenceReady = value.kind !== 'event' || !value.recurrence || !!(value.recurrence.until && value.date && value.recurrence.until >= value.date);
  const eventTimeReady = value.kind !== 'event' || value.allDay || !!(value.startTime && value.endTime);
  const requiredReady = value.kind === 'shift'
    ? Boolean(value.date && shiftType)
    : Boolean(value.title.trim() && value.date && eventTimeReady && recurrenceReady);
  const canSave = requiredReady
    && (value.ambiguities.length === 0 || confirmedAmbiguities)
    && (conflicts.length === 0 || confirmedConflicts)
    && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (value.kind === 'shift') {
        if (shiftType?.isOff) {
          toast('OFF는 근무 입력 화면에서 날짜를 비우는 방식으로 사용해 주세요.');
          return;
        }
        await setShiftAssignment({ date: value.date!, shiftTypeId: shiftType!.id });
        toast('근무를 저장했습니다.');
      } else {
        const dates = value.recurrence ? occurrenceDates : [value.date!];
        if (!dates.length) throw new Error('반복 종료일을 확인해 주세요.');
        const ranges = dates.map((date) => value.allDay
          ? allDayRange(date)
          : {
              start: localDateTimeToISO(date, value.startTime!),
              end: localDateTimeToISO(date, value.endTime!, isEndOnNextDay(value.startTime!, value.endTime!)),
              allDay: false,
            });
        const first = ranges[0];
        const created = await createTask({
          title: value.title.trim(),
          category: value.category,
          description: value.note?.trim() || undefined,
          location: value.location?.trim() || undefined,
          stage: 'todo',
          checked: false,
          start: first.start,
          end: first.end,
          allDay: first.allDay,
          isEvent: true,
          hiddenOnCalendar: false,
          parentId: null,
          calendarId: 'local',
        });
        if (ranges.length > 1) await addRanges(created.id, ranges.slice(1));
        toast(value.recurrence ? '반복 일정 ' + ranges.length + '회를 저장했습니다.' : '일정을 저장했습니다.');
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="quick-add-preview">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-medium text-gray-500">저장 전 확인</p><h2 className="mt-1 text-lg font-semibold">{value.kind === 'shift' ? '교대근무' : '일정'}</h2></div>
        <button type="button" className="btn inline-flex items-center gap-2" onClick={onBack}><ArrowLeft className="h-4 w-4" />다시 입력</button>
      </div>

      {value.kind === 'shift'
        ? <ShiftFields value={value} onChange={onChange} shiftTypes={shiftTypes} />
        : <EventFields value={value} onChange={onChange} />}

      {value.kind === 'event' && value.recurrence && (!value.recurrence.until || (value.date && value.recurrence.until < value.date)) && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-medium">{value.recurrence.until ? '반복 종료일은 첫 반복일 이후로 선택해 주세요.' : '반복 종료일을 선택해 주세요.'}</p>
          <p className="mt-1 text-xs">종료일까지 선택한 요일에 반복 일정을 생성합니다.</p>
        </div>
      )}

      {value.ambiguities.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-medium">확인이 필요한 항목</p><ul className="mt-1 list-disc space-y-1 pl-5">{value.ambiguities.map((item)=><li key={item}>{item}</li>)}</ul></div></div>
          <label className="mt-3 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={confirmedAmbiguities} onChange={(e)=>setConfirmedAmbiguities(e.target.checked)}/>입력값을 직접 확인했습니다.</label>
        </div>
      )}

      {conflicts.length > 0 && <ConflictWarning conflicts={conflicts} confirmed={confirmedConflicts} onConfirm={setConfirmedConflicts} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-5 disabled:opacity-50" disabled={!canSave} onClick={()=>void save()}>
          <CalendarCheck2 className="h-4 w-4"/>{saving ? '저장 중…' : value.kind === 'shift' ? '근무 저장' : '일정 저장'}
        </button>
      </div>
    </div>
  );
}

function ConflictWarning({ conflicts, confirmed, onConfirm }: { conflicts: BusyInterval[]; confirmed: boolean; onConfirm: (value: boolean) => void }) {
  const time = (date: Date) => date.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false });
  return <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-medium">기존 일정 또는 근무와 겹칩니다.</p><ul className="mt-2 space-y-1">{conflicts.slice(0,8).map((item,i)=><li key={item.source+item.sourceId+i}>{item.title} · {time(item.start)}–{time(item.end)}</li>)}</ul></div></div>
    <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e)=>onConfirm(e.target.checked)}/>겹침을 확인했고 그대로 저장합니다.</label>
  </div>;
}

function EventFields({ value, onChange }: { value: ParsedEvent; onChange: (value: ParsedKoreanInput) => void }) {
  const patch = (next: Partial<ParsedEvent>) => onChange({ ...value, ...next });
  const clearTimeAmbiguities = (items: string[]) => items.filter((item)=>!/(정확한 시간을 입력|시작 시간을 선택|오전인지 오후인지|시간이 올바르지)/.test(item));
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>일정 이름</span><input className="input" value={value.title} onChange={(e)=>patch({title:e.target.value})}/></label>
    <label className="flex flex-col gap-1 text-sm"><span>{value.recurrence ? '첫 반복일' : '날짜'}</span><input className="input" type="date" value={value.date ?? ''} onChange={(e)=>patch({date:e.target.value||undefined})}/></label>
    <CategorySelect value={value.category} onChange={(category)=>patch({category})}/>
    {value.recurrence && <>
      <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-950"><p className="text-xs text-blue-600">반복</p><p className="mt-1 font-semibold">{weeklyRecurrenceLabel(value.recurrence.weekdays)}</p></div>
      <label className="flex flex-col gap-1 text-sm"><span>반복 종료일</span><input className="input" type="date" min={value.date ?? undefined} value={value.recurrence.until ?? ''} onChange={(e)=>patch({recurrence:{...value.recurrence!,until:e.target.value||undefined}})}/></label>
    </>}
    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!value.allDay} onChange={(e)=>patch({allDay:e.target.checked, ambiguities:e.target.checked ? clearTimeAmbiguities(value.ambiguities) : value.ambiguities})}/>하루 종일</label>
    {!value.allDay && <>
      <label className="flex flex-col gap-1 text-sm"><span>시작시간</span><input className="input" type="time" value={value.startTime ?? ''} onChange={(e)=>patch({startTime:e.target.value||undefined, ambiguities:e.target.value ? clearTimeAmbiguities(value.ambiguities) : value.ambiguities})}/></label>
      <label className="flex flex-col gap-1 text-sm"><span>종료시간</span><input className="input" type="time" value={value.endTime ?? ''} onChange={(e)=>patch({endTime:e.target.value||undefined})}/></label>
    </>}
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>장소</span><input className="input" value={value.location ?? ''} onChange={(e)=>patch({location:e.target.value||undefined})}/></label>
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>메모</span><textarea className="input min-h-20" value={value.note ?? ''} onChange={(e)=>patch({note:e.target.value||undefined})}/></label>
  </div>;
}

function ShiftFields({ value, onChange, shiftTypes }: { value: ParsedShift; onChange: (value: ParsedKoreanInput) => void; shiftTypes: ReturnType<typeof useStore.getState>['shiftTypes'] }) {
  const selected=shiftTypes.find((type)=>type.code===value.shiftCode);
  const time=!selected||selected.isOff ? '근무 없음' : String(selected.startTime) + '–' + (selected.crossesMidnight?'익일 ':'') + String(selected.endTime);
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm"><span>날짜</span><input className="input" type="date" value={value.date ?? ''} onChange={(e)=>onChange({...value,date:e.target.value||undefined})}/></label>
    <label className="flex flex-col gap-1 text-sm"><span>근무유형</span><select className="input" value={value.shiftCode} onChange={(e)=>onChange({...value,shiftCode:e.target.value})}>{shiftTypes.filter((type)=>type.enabled).map((type)=><option key={type.id} value={type.code}>{type.code} / {type.name}</option>)}</select></label>
    <div className="rounded-xl bg-gray-50 p-4 text-sm sm:col-span-2"><p className="text-gray-500">시간</p><p className="mt-1 font-medium">{time}</p></div>
  </div>;
}

