'use client';

import { AlertTriangle, ArrowLeft, CalendarCheck2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { localDateTimeToISO, isEndOnNextDay, type ParsedEvent, type ParsedKoreanInput, type ParsedShift } from '@/lib/nlp';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import CategorySelect from './CategorySelect';

type Props = {
  value: ParsedKoreanInput;
  onChange: (value: ParsedKoreanInput) => void;
  onBack: () => void;
  onSaved: () => void;
};

export default function QuickAddPreview({ value, onChange, onBack, onSaved }: Props) {
  const createTask = useStore((state) => state.createTask);
  const setShiftAssignment = useStore((state) => state.setShiftAssignment);
  const shiftTypes = useStore((state) => state.shiftTypes);
  const [confirmedAmbiguities, setConfirmedAmbiguities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shiftType = useMemo(() => value.kind === 'shift' ? shiftTypes.find((type) => type.code === value.shiftCode) : undefined, [shiftTypes, value]);
  const requiredReady = value.kind === 'shift'
    ? Boolean(value.date && shiftType)
    : Boolean(value.title.trim() && value.date && value.startTime && value.endTime);
  const canSave = requiredReady && (value.ambiguities.length === 0 || confirmedAmbiguities) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (value.kind === 'shift') {
        await setShiftAssignment({ date: value.date!, shiftTypeId: shiftType!.id });
        toast('근무를 저장했습니다.');
      } else {
        const start = localDateTimeToISO(value.date!, value.startTime!);
        const end = localDateTimeToISO(value.date!, value.endTime!, isEndOnNextDay(value.startTime!, value.endTime!));
        await createTask({
          title: value.title.trim(),
          category: value.category,
          description: value.note?.trim() || undefined,
          location: value.location?.trim() || undefined,
          stage: 'todo', checked: false,
          start, end, allDay: false, isEvent: true, hiddenOnCalendar: false,
          parentId: null, calendarId: 'local',
        });
        toast('일정을 저장했습니다.');
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5" data-testid="quick-add-preview">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-gray-500">저장 전 확인</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-950">{value.kind === 'shift' ? '교대근무 Preview' : '일정 Preview'}</h2>
      </div>
      <button type="button" className="btn inline-flex items-center gap-2" onClick={onBack}><ArrowLeft className="h-4 w-4" />다시 입력</button>
    </div>

    {value.kind === 'shift'
      ? <ShiftFields value={value} onChange={onChange} shiftTypes={shiftTypes} />
      : <EventFields value={value} onChange={onChange} />}

    {value.ambiguities.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">확인이 필요한 항목</p><ul className="mt-1 list-disc space-y-1 pl-5">{value.ambiguities.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
      <label className="mt-3 flex cursor-pointer items-center gap-2"><input type="checkbox" checked={confirmedAmbiguities} onChange={(event) => setConfirmedAmbiguities(event.target.checked)} /><span>입력값을 직접 확인했습니다.</span></label>
    </div>}
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end">
      <button type="button" className="btn btn-primary inline-flex min-h-11 items-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSave} onClick={() => void save()}>
        <CalendarCheck2 className="h-4 w-4" />{saving ? '저장 중…' : value.kind === 'shift' ? '근무 저장' : '일정 저장'}
      </button>
    </div>
  </div>;
}

function EventFields({ value, onChange }: { value: ParsedEvent; onChange: (value: ParsedKoreanInput) => void }) {
  const patch = (next: Partial<ParsedEvent>) => onChange({ ...value, ...next });
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>제목</span><input className="input" value={value.title} onChange={(event) => patch({ title: event.target.value })} placeholder="일정 제목" /></label>
    <label className="flex flex-col gap-1 text-sm"><span>날짜</span><input className="input" type="date" value={value.date ?? ''} onChange={(event) => patch({ date: event.target.value || undefined })} /></label>
    <CategorySelect value={value.category} onChange={(category) => patch({ category })} />
    <label className="flex flex-col gap-1 text-sm"><span>시작시간</span><input className="input" type="time" value={value.startTime ?? ''} onChange={(event) => patch({ startTime: event.target.value || undefined })} /></label>
    <label className="flex flex-col gap-1 text-sm"><span>종료시간</span><input className="input" type="time" value={value.endTime ?? ''} onChange={(event) => patch({ endTime: event.target.value || undefined })} /></label>
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>장소</span><input className="input" value={value.location ?? ''} onChange={(event) => patch({ location: event.target.value || undefined })} placeholder="장소 없음" /></label>
    <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>메모</span><textarea className="input min-h-20 resize-y" value={value.note ?? ''} onChange={(event) => patch({ note: event.target.value || undefined })} placeholder="메모 없음" /></label>
  </div>;
}

function ShiftFields({ value, onChange, shiftTypes }: { value: ParsedShift; onChange: (value: ParsedKoreanInput) => void; shiftTypes: ReturnType<typeof useStore.getState>['shiftTypes'] }) {
  const selected = shiftTypes.find((type) => type.code === value.shiftCode);
  const time = !selected || selected.isOff ? '근무시간 없음' : `${selected.startTime}–${selected.crossesMidnight ? '익일 ' : ''}${selected.endTime}`;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm"><span>날짜</span><input className="input" type="date" value={value.date ?? ''} onChange={(event) => onChange({ ...value, date: event.target.value || undefined })} /></label>
    <label className="flex flex-col gap-1 text-sm"><span>근무유형</span><select className="input" value={value.shiftCode} onChange={(event) => onChange({ ...value, shiftCode: event.target.value as ParsedShift['shiftCode'] })}>{shiftTypes.filter((type) => type.enabled).map((type) => <option key={type.id} value={type.code}>{type.code} / {type.name}</option>)}</select></label>
    <div className="rounded-xl bg-gray-50 p-4 text-sm sm:col-span-2"><p className="text-gray-500">시간</p><p className="mt-1 font-medium text-gray-950">{time}</p></div>
  </div>;
}
